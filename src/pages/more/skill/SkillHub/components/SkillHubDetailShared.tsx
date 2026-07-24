import {
  DialogPlugin,
  Textarea,
  type TreeOptionData
} from 'tdesign-vue-next'
import { ChatContent } from '@tdesign-vue-next/chat'
import { MessageUtil } from '@/utils/modal'
import { prettyDataUnit } from '@/utils/lang/FormatUtil'
import { skillHubApiV1SkillsFile, type ApiV1SkillFileItem } from '@/modules/skillhub'

export interface FileTreeNode extends TreeOptionData {
  label: string
  value: string
  children?: FileTreeNode[]
  isFile?: boolean
  size?: number
}

export const buildFileTree = (files: ApiV1SkillFileItem[]): FileTreeNode[] => {
  const root: FileTreeNode[] = []
  const dirMap = new Map<string, FileTreeNode>()

  const ensureDir = (parts: string[]): FileTreeNode[] => {
    let list = root
    let path = ''
    for (const part of parts) {
      path = path ? `${path}/${part}` : part
      let node = dirMap.get(path)
      if (!node) {
        node = { label: part, value: path, children: [] }
        dirMap.set(path, node)
        list.push(node)
      }
      list = node.children ?? []
      node.children = list
    }
    return list
  }

  for (const file of files) {
    const segs = file.path.split('/').filter(Boolean)
    if (segs.length === 0) continue
    const name = segs[segs.length - 1]
    const parentParts = segs.slice(0, -1)
    const list = parentParts.length ? ensureDir(parentParts) : root
    list.push({
      label: name,
      value: file.path,
      isFile: true,
      size: file.size
    })
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      const ad = a.isFile ? 1 : 0
      const bd = b.isFile ? 1 : 0
      if (ad !== bd) return ad - bd
      return String(a.label).localeCompare(String(b.label))
    })
    for (const n of nodes) {
      if (n.children?.length) sortNodes(n.children)
    }
  }
  sortNodes(root)
  return root
}

export const openSkillHubFileView = async (slug: string, path: string, size?: number) => {
  let content = ''
  try {
    content = await skillHubApiV1SkillsFile(slug, path)
  } catch (e) {
    MessageUtil.error('读取文件失败', e)
    return
  }
  const isMd = /\.md$/i.test(path)
  const header = size != null ? `${path}（${prettyDataUnit(size)}）` : path
  DialogPlugin({
    header,
    placement: 'center',
    width: '70vw',
    footer: false,
    default: () =>
      isMd ? (
        <div style={{ maxHeight: '60vh', overflow: 'auto', padding: '4px 0' }}>
          <ChatContent content={content} />
        </div>
      ) : (
        <Textarea
          value={content}
          readonly={true}
          autosize={false}
          style={{ height: '60vh', fontFamily: 'var(--td-font-family-mono, monospace)' }}
        />
      )
  })
}
