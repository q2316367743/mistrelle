import { PluginKey } from '@tiptap/pm/state'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { Ref } from 'vue'
import type { ChatFileRef } from '@/utils/chatSender'
import type { LocalSkill } from '@/modules/skill'
import { toolOptions } from '@/modules/tool'

// suggestion 运行时注入的 props（仅取框架确实会回传的字段；selectedIndex 由闭包维护，框架不回传）
interface RuntimeSuggestionProps {
  items: unknown[]
  command: (item: unknown) => void
  clientRect?: () => DOMRect | null
  event: KeyboardEvent
}
interface FormatResult {
  title: string
  desc?: string
}

interface SuggestionRendererOptions {
  onOpenChange?: (open: boolean) => void
}

const buildContainer = (): HTMLDivElement => {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:fixed',
    'z-index:3000',
    'min-width:260px',
    'max-width:340px',
    'background:var(--td-bg-color-container,#fff)',
    'border:1px solid var(--td-component-border,#dcdcdc)',
    'border-radius:8px',
    'box-shadow:0 6px 24px rgba(0,0,0,0.12)',
    'padding:4px',
    'max-height:300px',
    'overflow:auto'
  ].join(';')
  document.body.appendChild(el)
  return el
}

const rowCss = (active: boolean): string =>
  [
    'padding:6px 10px',
    'border-radius:6px',
    'cursor:pointer',
    'display:flex',
    'flex-direction:column',
    'gap:2px',
    active ? 'background:var(--td-brand-color-light,#e0eaff)' : 'background:transparent'
  ].join(';')

/**
 * 轻量 suggestion 弹层（纯 DOM，避免引入 tippy）。返回 Tiptap suggestion 的 render 回调。
 * 注意：Tiptap 的 onKeyDown 回传的 props（SuggestionKeyDownProps）不含 items，
 * 因此 items / selectedIndex / command 必须以闭包状态维护，不能从 props 上读取。
 */
export const makeSuggestionRenderer = (
  format: (item: unknown) => FormatResult,
  options: SuggestionRendererOptions = {}
): SuggestionOptions['render'] => {
  return () => {
    let container: HTMLDivElement | null = null
    let items: unknown[] = []
    let selectedIndex = 0
    let triggerCommand: (item: unknown) => void = () => {}

    const renderRows = (el: HTMLElement) => {
      el.innerHTML = ''
      items.forEach((item, index) => {
        const { title, desc } = format(item)
        const row = document.createElement('div')
        row.style.cssText = rowCss(index === selectedIndex)

        const titleEl = document.createElement('div')
        titleEl.textContent = title
        titleEl.style.cssText =
          'font-size:13px;color:var(--td-text-color-primary,#000);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
        row.appendChild(titleEl)

        if (desc) {
          const descEl = document.createElement('div')
          descEl.textContent = desc
          descEl.style.cssText =
            'font-size:12px;color:var(--td-text-color-placeholder,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
          row.appendChild(descEl)
        }

        row.addEventListener('mousedown', (event) => {
          event.preventDefault()
          triggerCommand(item)
        })
        row.addEventListener('mouseenter', () => {
          selectedIndex = index
          renderRows(el)
        })
        el.appendChild(row)
      })
    }

    // 弹层默认显示在光标上方（输入框在页面底部，向上弹更符合直觉）；
    // 上方空间不足时回退到下方，避免被视口顶部裁切。
    const positionPopup = (props: RuntimeSuggestionProps, el: HTMLElement) => {
      const rect = props.clientRect?.()
      if (!rect) return
      const gap = 4
      const popupHeight = el.offsetHeight
      el.style.left = `${rect.left}px`
      const topAbove = rect.top - popupHeight - gap
      if (topAbove >= 0) {
        el.style.top = `${topAbove}px`
      } else {
        el.style.top = `${rect.bottom + gap}px`
      }
    }

    return {
      onStart: (props) => {
        const p = props as unknown as RuntimeSuggestionProps
        selectedIndex = 0
        items = p.items ?? []
        triggerCommand = p.command
        options.onOpenChange?.(true)
        container = buildContainer()
        renderRows(container)
        positionPopup(p, container)
      },
      onUpdate: (props) => {
        const p = props as unknown as RuntimeSuggestionProps
        selectedIndex = 0
        items = p.items ?? []
        triggerCommand = p.command
        if (!container) return
        renderRows(container)
        positionPopup(p, container)
      },
      onKeyDown: (props) => {
        const p = props as unknown as RuntimeSuggestionProps
        const event = p.event
        if (items.length === 0) return false
        if (event.key === 'ArrowDown') {
          selectedIndex = (selectedIndex + 1) % items.length
          if (container) renderRows(container)
          return true
        }
        if (event.key === 'ArrowUp') {
          selectedIndex = (selectedIndex - 1 + items.length) % items.length
          if (container) renderRows(container)
          return true
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex] == null) return false
          triggerCommand(items[selectedIndex])
          return true
        }
        return false
      },
      onExit: () => {
        options.onOpenChange?.(false)
        if (container?.parentNode) container.parentNode.removeChild(container)
        container = null
      }
    }
  }
}

export interface SkillSuggestionItem {
  id: string
  label: string
  data: LocalSkill
}

export const buildSkillSuggestion = (
  skills: Ref<LocalSkill[]>,
  options?: SuggestionRendererOptions
): Partial<SuggestionOptions<SkillSuggestionItem>> => ({
  char: '/',
  pluginKey: new PluginKey('skillMention'),
  items: ({ query }) =>
    skills.value
      .filter((s) =>
        `${s.name} ${s.dirName} ${s.description}`.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8)
      .map<SkillSuggestionItem>((s) => ({ id: s.path, label: s.name, data: s })),
  command: ({ editor, range, props }) => {
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'skillMention', attrs: { id: props.id, label: props.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  },
  render: makeSuggestionRenderer(
    (item) => {
      const s = item as SkillSuggestionItem
      return { title: s.label, desc: s.data.description }
    },
    options
  )
})

export interface FileSuggestionItem {
  id: string
  label: string
  data: ChatFileRef
}

export const buildFileSuggestion = (
  files: Ref<ChatFileRef[]>,
  options?: SuggestionRendererOptions
): Partial<SuggestionOptions<FileSuggestionItem>> => ({
  char: '@',
  pluginKey: new PluginKey('fileMention'),
  items: ({ query }) =>
    files.value
      .filter((f) => f.relativePath.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map<FileSuggestionItem>((f) => ({ id: f.path, label: f.relativePath, data: f })),
  command: ({ editor, range, props }) => {
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'fileMention', attrs: { id: props.id, label: props.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  },
  render: makeSuggestionRenderer(
    (item) => {
      const f = item as FileSuggestionItem
      return { title: f.label, desc: f.data.path }
    },
    options
  )
})

export interface ToolSuggestionItem {
  name: string
  label: string
  group: string
}

const allToolSuggestionItems = (): ToolSuggestionItem[] =>
  toolOptions.flatMap((group) =>
    group.children.map((tool) => ({
      name: String(tool.value),
      label: String(tool.label),
      group: group.group
    }))
  )

export const buildToolSuggestion = (
  options?: SuggestionRendererOptions
): Partial<SuggestionOptions<ToolSuggestionItem>> => ({
  char: '#',
  pluginKey: new PluginKey('toolMention'),
  items: ({ query }) =>
    allToolSuggestionItems()
      .filter((tool) =>
        `${tool.label} ${tool.name} ${tool.group}`.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8),
  command: ({ editor, range, props }) => {
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'toolMention', attrs: { name: props.name, label: props.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  },
  render: makeSuggestionRenderer(
    (item) => {
      const tool = item as ToolSuggestionItem
      return { title: tool.label, desc: `${tool.group} · ${tool.name}` }
    },
    options
  )
})
