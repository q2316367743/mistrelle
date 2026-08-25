/**
 * HTML 模板桥（preload）：模板渲染的 IPC 薄封装。
 * 模板文件与 EJS 渲染都在 main（service/templateRender.ts），渲染侧只传模板名与 view model。
 */
import { ipcRenderer } from 'electron'
import { TemplateChannels, type TemplateRenderParams } from './templateChannels'

export const templateApi = {
  /** 渲染 resources/templates/<name>.ejs 并返回完整 HTML 字符串（自包含、可直接预览或落盘） */
  render: (params: TemplateRenderParams): Promise<string> =>
    ipcRenderer.invoke(TemplateChannels.render, params)
}
