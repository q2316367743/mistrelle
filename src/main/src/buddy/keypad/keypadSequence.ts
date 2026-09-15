/**
 * 序列执行引擎（main 进程，模块级单例）：把控件某一路信号的动作序列顺序执行，
 * 并维护「连接会话世代」——断开（主动/拔线/换连接/保存绑定）即换代，
 * 让**在途序列立即失效**，从而保证断开瞬间所有按键动作都停下来。
 *
 * 从 keypadService 抽出（RL-05 行数红线 + 职责单一）：本模块只管「执行」，
 * 不管配置、连接与信号路由；依赖方向 keypadService → keypadHold → 本模块，无环。
 */
import { KEYPAD_ACTION_EXECUTORS } from './actions'
import type { KeypadAction } from '@common/types/keypad'

/**
 * 会话世代：当前世代的 aborted 信号在换代时 resolve，使卡在延时/异步动作上的 await 立刻返回，
 * 不再向下执行后续按键动作。注意：信号必须在下发时按世代捕获，不能读模块变量
 * （换代后它已指向新世代的未决 promise，会导致永不 resolve）。
 */
let sessionGeneration = 0
let abortCurrentSession: () => void = () => {}
let sessionSignal: Promise<void> = new Promise((resolve) => {
  abortCurrentSession = resolve
})

/**
 * 序列执行中的路由（防重入：序列含延时时长于物理按压，执行中忽略该路的再次触发）。
 * 值为发起时的会话世代——断开后旧序列的收尾只清理自己的世代，不会误删重连后新序列的条目。
 */
const running = new Map<string, number>()

/** 当前会话世代（事件分发时捕获，用于后续复核） */
export function generation(): number {
  return sessionGeneration
}

/** 该世代是否仍是当前会话（断开换代后所有在途执行立即失效） */
export function isLive(gen: number): boolean {
  return gen === sessionGeneration
}

/** 结束当前连接会话：中止在途执行（换代 + resolve 旧信号）并建档新会话供后续使用 */
export function endSession(): void {
  abortCurrentSession()
  sessionGeneration += 1
  sessionSignal = new Promise((resolve) => {
    abortCurrentSession = resolve
  })
}

/**
 * 顺序执行动作序列：逐条查执行器注册表 await onPress（delay 执行器以 sleep Promise 形成间隔）。
 * 单条失败记日志继续下一条（按键响应不阻塞、不抛出）；
 * **每条执行前复核会话有效**——断开换代后立刻停止，
 * 且卡在延时/异步动作上的 await 会被该世代的中止信号唤醒（与当前动作的 Promise 竞速）。
 */
export async function runSequence(actions: KeypadAction[], gen: number): Promise<void> {
  // 按世代捕获中止信号：断开换代时它 resolve，当前动作不再等待
  const signal = sessionSignal
  for (const action of actions) {
    if (!isLive(gen)) return
    try {
      const executing = Promise.resolve(KEYPAD_ACTION_EXECUTORS[action.type].onPress(action))
      await Promise.race([executing, signal])
    } catch (error) {
      console.error('[keypad] 动作执行失败', error)
    }
  }
}

/**
 * 启动某路信号的动作序列：执行中再次触发直接忽略（防连按并发重入）；fire-and-forget 不抛出。
 * 记录发起时的会话世代，断开换代后逐条复核，不再向下执行。
 */
export function dispatchSequence(key: string, actions: KeypadAction[], gen: number): void {
  if (running.get(key) === gen) return
  running.set(key, gen)
  void runSequence(actions, gen).finally(() => {
    // 仅当仍是自己这一代时才清理（断开换代后重连的同路新序列不受影响）
    if (running.get(key) === gen) running.delete(key)
  })
}

/** 结束全部在途序列（断开/保存绑定统一出口的第一步，先换代再清簿记，防复位后又被写状态） */
export function resetSequences(): void {
  endSession()
  running.clear()
}
