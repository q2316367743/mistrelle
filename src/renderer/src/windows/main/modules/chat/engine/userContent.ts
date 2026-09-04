import type { AttachmentItem, TextContent } from '@/domain'
import type { ChatFileRef } from '@/utils/chatSender'

export const buildTextContent = (text: string): TextContent => ({
  type: 'text',
  data: text,
  status: 'complete',
  time: Date.now()
})

export const fileTypeFromPath = (path: string): AttachmentItem['fileType'] => {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'doc'
  if (['ppt', 'pptx'].includes(ext)) return 'ppt'
  return 'txt'
}

export const toAttachmentItem = (file: ChatFileRef): AttachmentItem => ({
  name: file.name,
  url: file.path,
  fileType: fileTypeFromPath(file.path),
  extension: file.path.split('.').pop() ?? '',
  isReference: true
})
