/**
 * ffmpeg 运行 IPC：run（异步 spawn + 进度推送）/ kill / quit。
 *
 * 契约（与 utools runFFmpeg 对齐）：
 * - run 立即返回 { id }，随后通过 ffmpeg:progress / ffmpeg:done 事件推送
 * - 自动追加 -progress pipe:2，解析 stderr 的 key=value 行
 * - kill = 强杀进程；quit = 向 stdin 写 'q' 优雅退出
 * - exitCode 0 → done 无 error；非 0 → done 携带 error（stderr 尾部）
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { ensureFfmpegBinary } from '$/service/ffmpegBinary'
import { FfmpegChannels, type FfmpegDonePayload, type FfmpegProgress } from '~/ipc/channels'

interface RunningFfmpeg {
  child: ChildProcessWithoutNullStreams
  stderrTail: string
  progress: FfmpegProgress
}

const running = new Map<number, RunningFfmpeg>()
let nextId = 1

/** 解析单行 key=value（ffmpeg -progress 输出） */
const parseProgressLine = (progress: FfmpegProgress, line: string): void => {
  const idx = line.indexOf('=')
  if (idx <= 0) return
  const key = line.slice(0, idx)
  const value = line.slice(idx + 1)
  switch (key) {
    case 'frame':
      progress.frame = Number(value)
      break
    case 'fps':
      progress.fps = Number(value)
      break
    case 'bitrate':
      progress.bitrate = value
      break
    case 'total_size':
      progress.size = value
      break
    case 'out_time_us': {
      const seconds = Number(value) / 1e6
      progress.time = formatTime(seconds)
      break
    }
    case 'out_time_ms': {
      const seconds = Number(value) / 1e3
      progress.time = formatTime(seconds)
      break
    }
    case 'speed':
      progress.speed = value
      break
    case 'q':
      progress.q = Number.isNaN(Number(value)) ? value : Number(value)
      break
    default:
      break
  }
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '00:00:00.00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

const emitDone = (
  event: IpcMainInvokeEvent,
  id: number,
  payload: Omit<FfmpegDonePayload, 'id'>
): void => {
  event.sender.send(FfmpegChannels.done, { id, ...payload })
}

export function registerFfmpegIpc(): void {
  ipcMain.handle(FfmpegChannels.run, async (event, args: string[]) => {
    const binary = ensureFfmpegBinary()
    const id = nextId++
    // 追加进度输出；用户 args 已含 -progress 时 ffmpeg 会报错，属预期
    const child = spawn(binary, [...args.map(String), '-progress', 'pipe:2'], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const record: RunningFfmpeg = { child, stderrTail: '', progress: {} }
    running.set(id, record)
    let settled = false

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      record.stderrTail = (record.stderrTail + text).slice(-8192)
      let newlineIdx: number
      let rest = text
      while ((newlineIdx = rest.indexOf('\n')) >= 0) {
        const line = rest.slice(0, newlineIdx)
        rest = rest.slice(newlineIdx + 1)
        parseProgressLine(record.progress, line)
      }
      // 进度行到达即推送（无换行的残余留给下个 chunk）
      if (Object.keys(record.progress).length > 0 && !settled) {
        event.sender.send(FfmpegChannels.progress, { id, progress: { ...record.progress } })
      }
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      running.delete(id)
      emitDone(event, id, { error: err.message })
    })

    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      running.delete(id)
      if (code === 0) {
        emitDone(event, id, { exitCode: 0 })
      } else {
        emitDone(event, id, {
          exitCode: code,
          signal: signal ?? undefined,
          error: record.stderrTail.trim() || `ffmpeg 异常退出（code=${code}）`
        })
      }
    })

    return { id }
  })

  ipcMain.on(FfmpegChannels.kill, (_event, id: number) => {
    const record = running.get(id)
    if (!record) return
    record.child.kill('SIGKILL')
  })

  ipcMain.on(FfmpegChannels.quit, (_event, id: number) => {
    const record = running.get(id)
    if (!record) return
    try {
      record.child.stdin.write('q\n')
    } catch {
      record.child.kill('SIGTERM')
    }
  })
}
