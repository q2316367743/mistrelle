import type { AiImageBlock } from '@/windows/main/modules/ai'
import type { AttachmentContent, ChatMessage } from '@/domain'

/** 单图 base64 前大小上限（DeepSeek base64 单图上限 32MiB，留出请求体余量） */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/** 支持识图的图片扩展名 → MIME（对齐主流视觉 API：JPEG / PNG / GIF / WebP） */
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

export const imageMimeFromExtension = (ext?: string): string | undefined => {
  if (!ext) return undefined
  return IMAGE_MIME_BY_EXT[ext.toLowerCase().replace(/^\./, '')]
}

/** 从文件路径取扩展名推断 MIME（image_read 等只有路径没有扩展名字段的场景） */
export const imageMimeFromPath = (path: string): string | undefined => {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return undefined
  return IMAGE_MIME_BY_EXT[path.slice(dot + 1).toLowerCase()]
}

/** ArrayBuffer → base64（分块 String.fromCharCode，避免大文件栈溢出） */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)))
  }
  return btoa(chunks.join(''))
}

export interface VisionCollectResult {
  /** 消息 id → 该消息引用图片转出的图像内容块 */
  blocksByMessageId: Map<string, AiImageBlock[]>
  /** 已成功转为图像块的附件 url，用于文本引用标注去重 */
  attachedUrls: Set<string>
}

/**
 * 收集全部用户消息引用的图片附件，读盘转 data URL 图像块（全部历史保留策略：
 * 每次构造请求时从磁盘路径重建，落库仍为路径引用）。读盘失败 / 超限 / 格式不支持的图片跳过。
 */
export const collectVisionBlocks = async (
  messages: ChatMessage[]
): Promise<VisionCollectResult> => {
  const blocksByMessageId = new Map<string, AiImageBlock[]>()
  const attachedUrls = new Set<string>()
  for (const message of messages) {
    if (message.role !== 'user') continue
    const attachments = message.content
      .filter((item): item is AttachmentContent => item.type === 'attachment')
      .flatMap((item) => item.data)
    const blocks: AiImageBlock[] = []
    for (const item of attachments) {
      const mime = imageMimeFromExtension(item.extension)
      if (item.fileType !== 'image' || !item.url || !mime) continue
      try {
        const buffer = await window.preload.fs.readBinaryFile(item.url)
        if (buffer.byteLength > MAX_IMAGE_BYTES) continue
        blocks.push({
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${arrayBufferToBase64(buffer)}` }
        })
        attachedUrls.add(item.url)
      } catch {
        // 读盘失败（权限 / 文件已移动）不阻断对话，该图仅保留路径文本引用
      }
    }
    if (blocks.length > 0) blocksByMessageId.set(message.id, blocks)
  }
  return { blocksByMessageId, attachedUrls }
}

export interface ToolCallVisionOptions {
  /** 已注入路径（如用户附件已转为图像块的 url），同一张图不重复注入 */
  excludePaths?: ReadonlySet<string>
  /** 跳过的工具调用 id（紧凑化已过期 / 已剔除的调用，无需为其读盘） */
  skipToolCallIds?: ReadonlySet<string>
}

/**
 * 收集历史工具调用引用的图片（image_read 成功后经 ext.visionImagePaths 落库的路径），
 * 读盘重建为 toolCallId → 图像块映射。请求构建时以「紧随 tool 消息的 user 消息」
 * 注入模型上下文（工具结果消息本身不支持图像块），落库仍为路径引用。
 */
export const collectToolCallVisionBlocks = async (
  messages: ChatMessage[],
  options: ToolCallVisionOptions = {}
): Promise<Map<string, AiImageBlock[]>> => {
  const blocksByToolCallId = new Map<string, AiImageBlock[]>()
  const injected = new Set(options.excludePaths ?? [])
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const content of message.content ?? []) {
      if (content.type !== 'toolcall') continue
      const call = content.data
      if (options.skipToolCallIds?.has(call.toolCallId)) continue
      const paths = content.ext?.visionImagePaths
      if (!Array.isArray(paths)) continue
      const blocks: AiImageBlock[] = []
      for (const item of paths) {
        if (typeof item !== 'string' || !item || injected.has(item)) continue
        const mime = imageMimeFromPath(item)
        if (!mime) continue
        try {
          const buffer = await window.preload.fs.readBinaryFile(item)
          if (buffer.byteLength > MAX_IMAGE_BYTES) continue
          blocks.push({
            type: 'image_url',
            image_url: { url: `data:${mime};base64,${arrayBufferToBase64(buffer)}` }
          })
          injected.add(item)
        } catch {
          // 读盘失败（文件已移动 / 权限）不阻断对话，该次调用仅保留结果文本
        }
      }
      if (blocks.length > 0) blocksByToolCallId.set(call.toolCallId, blocks)
    }
  }
  return blocksByToolCallId
}
