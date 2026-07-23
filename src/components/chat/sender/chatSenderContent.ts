import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { AttachmentContent, SkillContent, UserMessageContent } from '@/domain'
import { buildTextContent, toAttachmentItem } from '@/modules/chat/engine/userContent'

export const serializeEditorContent = (editor: Editor): UserMessageContent[] => {
  const content: UserMessageContent[] = []
  let textBuffer = ''
  let trimNextLeadingSpace = false

  const flushText = () => {
    if (!textBuffer.trim()) {
      textBuffer = ''
      return
    }
    content.push(buildTextContent(textBuffer))
    textBuffer = ''
  }

  const appendText = (text: string) => {
    const normalized = trimNextLeadingSpace ? text.replace(/^[ \t]/, '') : text
    trimNextLeadingSpace = false
    textBuffer += normalized
  }

  const pushSkill = (node: PMNode) => {
    flushText()
    content.push({
      type: 'skill',
      data: { path: String(node.attrs.id ?? ''), name: String(node.attrs.label ?? '') },
      status: 'complete',
      time: Date.now()
    } satisfies SkillContent)
    trimNextLeadingSpace = true
  }

  const pushFile = (node: PMNode) => {
    const label = String(node.attrs.label ?? '')
    flushText()
    content.push({
      type: 'attachment',
      data: [
        toAttachmentItem({
          path: String(node.attrs.id ?? ''),
          name: label.split('/').pop() || label,
          relativePath: label
        })
      ],
      status: 'complete',
      time: Date.now()
    } satisfies AttachmentContent)
    trimNextLeadingSpace = true
  }

  const serializeNode = (node: PMNode) => {
    if (node.type.name === 'text') {
      appendText(node.text ?? '')
      return
    }
    if (node.type.name === 'hardBreak') {
      appendText('\n')
      return
    }
    if (node.type.name === 'skillMention') {
      pushSkill(node)
      return
    }
    if (node.type.name === 'fileMention') {
      pushFile(node)
      return
    }
    node.forEach(serializeNode)
  }

  editor.state.doc.forEach((node, _offset, index) => {
    if (index > 0) appendText('\n')
    serializeNode(node)
  })

  flushText()
  const lastItem = content[content.length - 1]
  if (lastItem?.type === 'text') lastItem.data = lastItem.data.trimEnd()
  return content
}
