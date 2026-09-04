import { Leafer } from 'leafer-editor'

export interface OffscreenLeafer {
  leafer: Leafer
  canvas: HTMLCanvasElement
  host: HTMLElement
  dispose: () => void
}

/**
 * 创建挂载在临时隐藏容器中的离屏 Leafer 画布。
 * 注意：leafer 初始化时会把 canvas 的父元素内联设为 `user-select: none`，若直接挂到 body 会永久污染
 * body 样式（销毁时不会自动恢复），因此必须挂到可整体移除的临时 host 容器上。
 */
export const createOffscreenLeafer = (width: number, height: number): OffscreenLeafer => {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-9999px;top:0'
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  host.appendChild(canvas)
  document.body.appendChild(host)
  const leafer = new Leafer({ view: canvas, width, height })
  const dispose = () => {
    leafer.destroy()
    host.remove()
  }
  return { leafer, canvas, host, dispose }
}
