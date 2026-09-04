/**
 * 字体 FontFace 注册器：把 library / online 字体加载进 document.fonts 的统一实现（供画布渲染层与预览层共用）。
 *
 * - 用 FontFace 的 URL 源 new FontFace(name, url("pathToHref(path)")) 让浏览器按本地事件服务的
 *   HTTP 资源面（/file/<enc 绝对路径>）异步加载，不经 IPC 读整包字节进渲染进程（浏览器自带缓存）。
 * - 注册进 document.fonts 的 FontFace 不会自动释放（画布/组件销毁也不释放），因此按最近使用（LRU）
 *   设上限，超限即 document.fonts.delete 淘汰最久未用者；字体源经资源 URL 可随时按需重载，淘汰安全。
 * - ensure 幂等：已注册则刷新 lastUsed 直接返回；加载中并发去重。
 *
 * 每个调用方（createFontFaceRegistry(maxFaces)）持有独立实例：独立上限、独立 clear（如预览页刷新时
 * 清空预览字体而不影响画布已注册字体）。
 */

import { FontSource } from '@/domain/FontItem'

/** 注册器接收的字体信息（FontItem 的子集） */
export interface FontFaceRegistryFont {
  name: string
  path: string
  source: FontSource
}

export interface FontFaceRegistry {
  /** 确保字体已加载进 document.fonts；system 直接跳过；失败静默降级 */
  ensure: (font: FontFaceRegistryFont) => Promise<void>
  /** 清空并释放全部已注册字体（document.fonts.delete） */
  clear: () => void
  /** 当前驻留字体数（调试 / 观察用） */
  size: () => number
}

export const createFontFaceRegistry = (maxFaces: number): FontFaceRegistry => {
  /** family → { face, lastUsed }。记录 face 引用供 document.fonts.delete 主动释放 */
  const faces = new Map<string, { face: FontFace; lastUsed: number }>()
  /** 加载中的 Promise（去重，避免同一字体并发重复加载） */
  const loading = new Map<string, Promise<void>>()

  /** 渲染进程 document.fonts 可用性降级开关（不可用时静默跳过 FontFace，不影响预览） */
  const supportsFontFace = typeof document !== 'undefined' && 'fonts' in document

  /** TS lib.dom 未为 FontFaceSet 建模 add()/delete()，运行时存在，窄断言补全（lib 缺陷导致的必要 as） */
  const fontSetAdd = (face: FontFace): void => {
    const set = document.fonts as FontFaceSet & { add(font: FontFace): unknown }
    set.add(face)
  }
  const fontSetDelete = (face: FontFace): void => {
    const set = document.fonts as FontFaceSet & { delete(font: FontFace): boolean }
    set.delete(face)
  }

  /** 注册后若超过上限，淘汰最久未使用的字体族 */
  const evictIfOverLimit = (): void => {
    while (faces.size >= maxFaces) {
      let oldestKey: string | null = null
      let oldestTs = Number.POSITIVE_INFINITY
      for (const [key, item] of faces) {
        if (item.lastUsed < oldestTs) {
          oldestTs = item.lastUsed
          oldestKey = key
        }
      }
      if (oldestKey === null) break
      const removed = faces.get(oldestKey)
      if (removed) {
        fontSetDelete(removed.face)
        faces.delete(oldestKey)
      }
    }
  }

  return {
    ensure(font: FontFaceRegistryFont): Promise<void> {
      if (font.source === 'system' || !supportsFontFace) return Promise.resolve()
      const key = font.name
      const existing = faces.get(key)
      if (existing) {
        existing.lastUsed = Date.now()
        return Promise.resolve()
      }
      const pending = loading.get(key)
      if (pending) return pending
      const task = (async () => {
        try {
          const face = new FontFace(font.name, `url("${window.preload.net.pathToHref(font.path)}")`)
          await face.load()
          fontSetAdd(face)
          faces.set(key, { face, lastUsed: Date.now() })
          evictIfOverLimit()
        } catch {
          // 字体损坏 / 加载失败：静默降级，不阻塞调用方
        } finally {
          loading.delete(key)
        }
      })()
      loading.set(key, task)
      return task
    },

    clear(): void {
      for (const { face } of faces.values()) fontSetDelete(face)
      faces.clear()
      loading.clear()
    },

    size(): number {
      return faces.size
    }
  }
}
