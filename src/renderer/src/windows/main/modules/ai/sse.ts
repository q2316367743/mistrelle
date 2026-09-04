/**
 * SSE 分帧器：把增量文本（UTF-8 解码后）切分成一个个事件帧。
 * - 帧以空行（\n\n 或 \r\n\r\n）分隔；`data:` 多行拼接为一条 data；
 * - `event:` 字段可选；`[DONE]` 作为普通 data 帧输出，由调用方识别；
 * - 块边界可能与帧边界错位，feed 需按字节流增量喂入。
 */
export interface SseFrame {
  event?: string
  data?: string
}

export class SseParser {
  private rest = ''
  private event?: string
  private dataParts: string[] = []

  /** 喂入一段文本，返回本轮解析出的完整帧 */
  feed(text: string): SseFrame[] {
    this.rest += text
    const frames: SseFrame[] = []
    let nlIndex: number
    while ((nlIndex = this.rest.search(/\r?\n/)) !== -1) {
      const raw = this.rest.slice(0, nlIndex)
      this.rest = this.rest.slice(nlIndex + 1)
      this.processLine(raw, frames)
    }
    return frames
  }

  /** 流结束时调用，flush 无空行结尾的残余帧 */
  flush(): SseFrame[] {
    const frames: SseFrame[] = []
    if (this.rest) {
      this.processLine(this.rest, frames)
      this.rest = ''
    }
    this.processLine('', frames)
    return frames
  }

  private processLine(line: string, frames: SseFrame[]): void {
    const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
    if (trimmed === '') {
      const frame = this.buildFrame()
      if (frame) frames.push(frame)
      this.event = undefined
      this.dataParts = []
      return
    }
    // 注释行（以冒号开头）忽略
    if (trimmed.startsWith(':')) return
    const colon = trimmed.indexOf(':')
    const field = colon === -1 ? trimmed : trimmed.slice(0, colon)
    const value = colon === -1 ? '' : trimmed.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') {
      this.event = value
    } else if (field === 'data') {
      this.dataParts.push(value)
    }
    // id / retry 等字段与 AI 流无关，忽略
  }

  private buildFrame(): SseFrame | undefined {
    if (this.dataParts.length === 0) return undefined
    return { event: this.event, data: this.dataParts.join('\n') }
  }
}
