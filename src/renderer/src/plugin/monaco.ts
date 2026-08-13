// monaco-editor 官方 Vite 集成：原生 `?worker` 导入 + MonacoEnvironment 分发
// 替代原 vite-plugin-monaco-editor（已移除），worker 由 Vite 直接打包
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  }
}
