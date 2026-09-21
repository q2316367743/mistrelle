import { nanoid } from 'nanoid'
import { readImageInfo } from '@/utils/imageInfo'
import { isPathUnder } from '@/utils/sandbox'
import type { CanvasDoc, CanvasNode } from './canvasTypes'
import { buildCanvasOutputsDir } from './canvasDocOps'
import type { CanvasStore } from './CanvasStore'

/** 可上传的图片扩展名（与画布 image 节点可渲染范围一致） */
export const CANVAS_UPLOAD_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico']

const uploadExtSet = new Set(CANVAS_UPLOAD_EXTS)

const isImageName = (name: string): boolean => {
  const ext = window.preload.path.extname(name).replace(/^\./, '').toLowerCase()
  return uploadExtSet.has(ext)
}

/** 上传源图片目录：outputs/uploads（画布 JSON 只存引用，图片字节集中在此） */
export const buildCanvasUploadsDir = (sandboxDir: string): string =>
  window.preload.path.join(buildCanvasOutputsDir(sandboxDir), 'uploads')

/** 重名自动追加 -1 / -2 … 后缀（与 inputs 拷贝惯例一致） */
const resolveUniqueName = async (dir: string, name: string): Promise<string> => {
  if (!(window.preload.fs.existsSync(window.preload.path.join(dir, name)))) return name
  const ext = window.preload.path.extname(name)
  const base = name.slice(0, name.length - ext.length)
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}${ext}`
    if (!(window.preload.fs.existsSync(window.preload.path.join(dir, candidate)))) return candidate
  }
  return `${base}-${Date.now()}${ext}`
}

/** 拷贝一张图片到 uploads 目录，返回落位后的绝对路径 */
const copyToUploads = async (sandboxDir: string, src: string): Promise<string> => {
  const dir = buildCanvasUploadsDir(sandboxDir)
  if (!(window.preload.fs.existsSync(dir))) {
    await window.preload.fs.mkdir(dir, true)
  }
  const target = window.preload.path.join(dir, await resolveUniqueName(dir, window.preload.path.basename(src)))
  await window.preload.fs.copyFile(src, target)
  return target
}

/**
 * 上传图片并各自创建引用画布（一图一画布，图片节点铺满画布），
 * 上传来源标记 source='upload'（可删除、不可归档）。最后一张设为当前画布。
 * 返回成功创建的画布数量（非图片扩展名被过滤）。
 */
export const uploadImages = async (
  sandboxDir: string,
  store: CanvasStore,
  paths: string[]
): Promise<number> => {
  const valid = paths.filter((src) => isImageName(window.preload.path.basename(src)))
  let count = 0
  for (const src of valid) {
    await createUploadCanvas(sandboxDir, store, src)
    count++
  }
  return count
}

const createUploadCanvas = async (
  sandboxDir: string,
  store: CanvasStore,
  imagePath: string
): Promise<void> => {
  const target = await copyToUploads(sandboxDir, imagePath)
  const base = window.preload.path.basename(target, window.preload.path.extname(target))
  const info = await readImageInfo(target)
  const width = Math.max(1, info?.width ?? 800)
  const height = Math.max(1, info?.height ?? 600)
  const doc = await store.create({ title: base, width, height, source: 'upload' })
  const node: CanvasNode = {
    id: nanoid(),
    type: 'image',
    name: base,
    x: 0,
    y: 0,
    width,
    height,
    imageUrl: target
  }
  doc.nodes.push(node)
  await store.save()
}

/** 删除 source=upload 画布引用的 uploads/ 源图片（仅清理仍位于 uploads 目录内的路径） */
export const removeUploadSourceFiles = async (sandboxDir: string, doc: CanvasDoc): Promise<void> => {
  const uploadsDir = buildCanvasUploadsDir(sandboxDir)
  const walk = async (nodes: CanvasNode[]): Promise<void> => {
    for (const node of nodes) {
      if (node.type === 'image' && node.imageUrl && isPathUnder(node.imageUrl, uploadsDir)) {
        if (window.preload.fs.existsSync(node.imageUrl)) {
          await window.preload.fs.rm(node.imageUrl)
        }
      }
      if (node.children?.length) await walk(node.children)
    }
  }
  await walk(doc.nodes)
}
