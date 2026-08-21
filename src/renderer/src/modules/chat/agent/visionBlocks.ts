import type { AiImageBlock } from '@/modules/ai'
import type { AttachmentContent, ChatMessage } from '@/domain'

/** 单图 base64 前大小上限（DeepSeek base64 单图上限 32MiB，留出请求体余量） */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

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
