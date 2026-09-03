/**
 * HTML 模板渲染 IPC handler（main 进程）：template:render 透传 templateRender 服务。
 */
import { ipcMain } from 'electron'
import { TemplateChannels, type TemplateRenderParams } from '~/modules/template/templateChannels'
import { renderTemplate } from './templateRender'

export function registerTemplateIpc(): void {
  ipcMain.handle(TemplateChannels.render, (_event, params: TemplateRenderParams): string =>
    renderTemplate(params.name, params.data)
  )
}
