/**
 * 长按会话（main 进程，模块级单例）：按住达到阈值后「做什么」由长按队列形状推导，不做配置。
 * - keep   单条普通「模拟按键」→ 按下保持、松手才抬起（真正的长按该键）
 * - repeat 多条 → 循环执行整个队列直到松手；单条媒体键 → 循环（媒体键无保持语义）
 * - once   单条非「模拟按键」→ 只执行一次，避免反复开窗口
 * 行为判定收口在 @common/types/keypad 的 resolveKeypadHoldBehavior，渲染层展示共用同一函数。
 *
 * 从 keypadService 抽出（RL-05 行数红线 + 职责单一）：本模块只管长按会话的生命周期，
 * 序列执行委托给 keypadSequence；依赖方向 keypadService → 本模块 → keypadSequence，无环。
 * 抬手（off）是权威停止出口；断开/保存绑定由 keypadService 调 endAllHolds 一并中止。
 */
import { KEYPAD_ACTION_EXECUTORS } from './actions'
import { dispatchSequence, isLive, runSequence } from './keypadSequence'
import { pressCombo, releaseCombo } from './keySimulator'
import {
  KEYPAD_REPEAT_MAX_MS,
  KEYPAD_REPEAT_MS_DEFAULT,
  resolveKeypadHoldBehavior,
  type KeypadAction,
  type KeypadComboAction
} from '@common/types/keypad'

/** 运行中的长按循环会话（路由键 → 循环；wake 用于抬手时中断当前间隔等待） */
interface HoldLoop {
  cancelled: boolean
  wake: (() => void) | null
}
const holdLoops = new Map<string, HoldLoop>()

/** 运行中的长按保持会话（路由键 → 已按住的组合，抬手时倒序抬起） */
interface KeepSession {
  cancelled: boolean
  held: KeypadComboAction[]
}
const keepSessions = new Map<string, KeepSession>()

/** 启动长按会话的入参（key 为路由键 `controlId:signal`） */
export interface HoldRequest {
  key: string
  actions: KeypadAction[]
  /** 循环间隔 ms（仅推导为 repeat 时生效；缺省 KEYPAD_REPEAT_MS_DEFAULT） */
  repeatMs?: number
  generation: number
  /** 该路由是否仍被按住（循环每轮复核，防 off 丢失导致无限连发） */
  isHeld: () => boolean
}

/**
 * 可中断等待：抬手（endHold）或断开（endAllHolds 经 service 换代）立即 resolve。
 * 断开时无须额外唤醒——endHold 会 wake，且调用方在 await 后还会复核 isLive。
 */
function interruptibleSleep(loop: HoldLoop, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      loop.wake = null
      resolve()
    }, ms)
    loop.wake = () => {
      clearTimeout(timer)
      loop.wake = null
      resolve()
    }
  })
}

/**
 * 长按循环：立即执行第一轮，随后每 interval 执行一轮（一轮跑完再等间隔，串行不重叠），
 * 抬手/断开即停。每轮前复核会话有效、信号仍按住与总时长上限（防 off 丢失导致无限连发）。
 */
async function runRepeatLoop(
  key: string,
  actions: KeypadAction[],
  interval: number,
  generation: number,
  isHeld: () => boolean
): Promise<void> {
  const loop: HoldLoop = { cancelled: false, wake: null }
  holdLoops.set(key, loop)
  const deadline = Date.now() + KEYPAD_REPEAT_MAX_MS
  try {
    while (isLive(generation) && !loop.cancelled && isHeld() && Date.now() < deadline) {
      await runSequence(actions, generation)
      if (!isLive(generation) || loop.cancelled || !isHeld() || Date.now() >= deadline) break
      await interruptibleSleep(loop, interval)
    }
  } finally {
    if (holdLoops.get(key) === loop) holdLoops.delete(key)
  }
}

/**
 * 长按保持：顺序执行长按队列，「模拟按键」调 pressCombo 且不自动抬起（抬手时统一释放），
 * 其余动作照常执行一次。断开/抬手经 endHold 立即释放并按倒序抬起。
 */
async function runKeepSession(
  key: string,
  actions: KeypadAction[],
  generation: number
): Promise<void> {
  const session: KeepSession = { cancelled: false, held: [] }
  keepSessions.set(key, session)
  for (const action of actions) {
    if (session.cancelled || !isLive(generation)) return
    try {
      if (action.type === 'combo') {
        pressCombo(action)
        session.held.push(action)
      } else {
        await KEYPAD_ACTION_EXECUTORS[action.type].onPress(action)
      }
    } catch (error) {
      console.error('[keypad] 长按保持动作执行失败', error)
    }
  }
}

/**
 * 启动长按会话（按住达到 KEYPAD_HOLD_MS 后由 keypadService 调用）：
 * 行为由长按队列形状推导，keep 保持按住 / repeat 循环 / once 执行一次。
 */
export function startHold(request: HoldRequest): void {
  const { key, actions, repeatMs, generation, isHeld } = request
  const behavior = resolveKeypadHoldBehavior(actions)
  if (behavior === 'keep') {
    void runKeepSession(key, actions, generation)
    return
  }
  if (behavior === 'repeat') {
    void runRepeatLoop(key, actions, repeatMs ?? KEYPAD_REPEAT_MS_DEFAULT, generation, isHeld)
    return
  }
  dispatchSequence(key, actions, generation)
}

/** 结束某路的长按会话（幂等）：终止循环并唤醒间隔等待、倒序抬起保持中的组合 */
export function endHold(key: string): void {
  const loop = holdLoops.get(key)
  if (loop) {
    loop.cancelled = true
    holdLoops.delete(key)
    loop.wake?.()
  }
  const session = keepSessions.get(key)
  if (session) {
    keepSessions.delete(key)
    session.cancelled = true
    for (let i = session.held.length - 1; i >= 0; i -= 1) releaseCombo(session.held[i])
    session.held.length = 0
  }
}

/** 结束全部长按会话（断开/拔线/换连接/保存绑定共用） */
export function endAllHolds(): void {
  for (const key of [...new Set([...holdLoops.keys(), ...keepSessions.keys()])]) {
    endHold(key)
  }
}
