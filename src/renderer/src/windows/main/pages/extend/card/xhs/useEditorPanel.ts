import { computed, ref, type Ref } from 'vue'
import { MessageUtil } from '@/utils/modal'
import { useCardStyleStore } from '@/windows/main/store'
import { state, INPUT_CLASS } from './state'
import {
  fileToImage,
  htmlToContent,
  loadImageMeta,
  looksLikeMarkdown,
  markdownToContent,
  wordToContent
} from './imports'
import type { XhsImage } from './protocol'

/** EditorPanel 的全部交互逻辑（参考站 EditorPanel.tsx 的 1:1 移植），模板单独承载 UI */
export const useEditorPanel = (textareaRef: Ref<HTMLTextAreaElement | null>) => {
  const styleStore = useCardStyleStore()
  const styleOptions = computed(() => styleStore.all.map((s) => ({ label: s.name, value: s.id })))

  const avatarInput = ref<HTMLInputElement | null>(null)
  const imagesInput = ref<HTMLInputElement | null>(null)
  const mdInput = ref<HTMLInputElement | null>(null)
  const wordInput = ref<HTMLInputElement | null>(null)
  const avatarDrag = ref(false)
  const imagesDrag = ref(false)
  const parsing = ref(false)

  // ------------------------------ 图片 ------------------------------
  const setAvatarFromFile = async (file: File) => {
    state.avatar = (await fileToImage(file)).src
  }
  const addImageFiles = async (files: Array<File>) => {
    const next: Array<XhsImage> = []
    for (const file of files) next.push(await fileToImage(file))
    if (next.length) state.images = [...state.images, ...next]
  }
  const onAvatarFile = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) await setAvatarFromFile(file)
    input.value = ''
  }
  const onImageFiles = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (files.length) await addImageFiles(files)
    input.value = ''
  }
  const onDrop = async (e: DragEvent, target: 'avatar' | 'image') => {
    avatarDrag.value = false
    imagesDrag.value = false
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    if (target === 'avatar') await setAvatarFromFile(files[0])
    else await addImageFiles(files)
  }

  // ------------------------------ 标记插入 ------------------------------
  const insertImageMark = () => {
    const el = textareaRef.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const mark = '[img]'
    state.content = state.content.substring(0, start) + mark + state.content.substring(end)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + mark.length, start + mark.length)
    }, 0)
  }

  const wrapMark = (mark: string) => {
    const el = textareaRef.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = state.content.substring(start, end) || '文字'
    const wrapped = selected.includes('\n')
      ? selected.split('\n').map((l) => (l.trim() ? mark + l + mark : l)).join('\n')
      : mark + selected + mark
    state.content = state.content.substring(0, start) + wrapped + state.content.substring(end)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + mark.length, start + wrapped.length - mark.length)
    }, 0)
  }

  // ------------------------------ 导入与粘贴 ------------------------------
  const insertImported = (text: string, images: Array<XhsImage>) => {
    const el = textareaRef.value
    const start = el ? el.selectionStart : state.content.length
    const end = el ? el.selectionEnd : state.content.length
    let block = text.trim()
    if (start > 0 && state.content[start - 1] !== '\n' && block) block = '\n' + block
    if (block && !block.endsWith('\n')) block += '\n'
    if (images.length) state.images = [...state.images, ...images]
    state.content = state.content.slice(0, start) + block + state.content.slice(end)
  }

  const onPaste = async (e: ClipboardEvent) => {
    const html = e.clipboardData?.getData('text/html') ?? ''
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f)
    const plain = e.clipboardData?.getData('text/plain') || ''
    const hasHtmlImage = /<img[\s>]/i.test(html)
    if (!html && files.length === 0) {
      if (plain && looksLikeMarkdown(plain)) {
        e.preventDefault()
        parsing.value = true
        try {
          const parsed = await markdownToContent(plain)
          insertImported(parsed.text || plain, parsed.images)
        } catch {
          insertImported(plain, [])
        } finally {
          parsing.value = false
        }
      }
      return
    }
    if (html && !hasHtmlImage && files.length === 0) return
    e.preventDefault()
    parsing.value = true
    try {
      const collected: Array<XhsImage> = []
      let text = ''
      if (hasHtmlImage) {
        const parsed = await htmlToContent(html)
        text = parsed.text
        for (const src of parsed.images) collected.push(await loadImageMeta(src))
      } else {
        text = plain
      }
      for (const file of files) {
        try {
          collected.push(await fileToImage(file))
          text += '\n[img]\n'
        } catch (err) {
          console.error('单张图片处理失败，已跳过', err)
        }
      }
      insertImported(text, collected)
    } catch (err) {
      console.error('粘贴解析失败', err)
      MessageUtil.warning('粘贴内容解析失败，请重试或改为手动上传图片')
    } finally {
      parsing.value = false
    }
  }

  const pasteAll = async () => {
    parsing.value = true
    try {
      const clipboardItems = await navigator.clipboard.read()
      let html = ''
      const blobs: Array<Blob> = []
      for (const item of clipboardItems) {
        if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text()
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) blobs.push(await item.getType(imageType))
      }
      const collected: Array<XhsImage> = []
      let text = ''
      if (html) {
        const parsed = await htmlToContent(html)
        text = parsed.text
        for (const src of parsed.images) collected.push(await loadImageMeta(src))
      } else if (blobs.length === 0) {
        const plain = await navigator.clipboard.readText()
        if (plain && looksLikeMarkdown(plain)) {
          const parsed = await markdownToContent(plain)
          text = parsed.text || plain
          collected.push(...parsed.images)
        } else {
          text = plain
        }
      }
      for (const blob of blobs) {
        try {
          collected.push(await fileToImage(new File([blob], 'clipboard', { type: blob.type })))
          text += '\n[img]\n'
        } catch (err) {
          console.error('单张图片处理失败，已跳过', err)
        }
      }
      insertImported(text, collected)
    } catch {
      MessageUtil.warning('无法直接读取剪贴板，请点击文本框后按 Cmd/Ctrl+V 粘贴')
      textareaRef.value?.focus()
    } finally {
      parsing.value = false
    }
  }

  const onMarkdownFile = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    input.value = ''
    parsing.value = true
    try {
      const parsed = await markdownToContent(await file.text())
      insertImported(parsed.text, parsed.images)
    } catch (err) {
      console.error('Markdown 导入失败', err)
      MessageUtil.error('Markdown 解析失败，请检查文件内容')
    } finally {
      parsing.value = false
    }
  }

  const onWordFile = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    input.value = ''
    parsing.value = true
    try {
      const parsed = await wordToContent(await file.arrayBuffer())
      const imgs: Array<XhsImage> = []
      for (const src of parsed.images) imgs.push(await loadImageMeta(src))
      insertImported(parsed.text, imgs)
    } catch (err) {
      console.error('Word 导入失败', err)
      MessageUtil.error(err instanceof Error ? err.message : 'Word 解析失败')
    } finally {
      parsing.value = false
    }
  }

  return {
    state,
    INPUT_CLASS,
    styleOptions,
    avatarInput,
    imagesInput,
    mdInput,
    wordInput,
    textareaRef,
    avatarDrag,
    imagesDrag,
    parsing,
    insertImageMark,
    wrapMark,
    onPaste,
    pasteAll,
    onAvatarFile,
    onImageFiles,
    onDrop,
    onMarkdownFile,
    onWordFile
  }
}
