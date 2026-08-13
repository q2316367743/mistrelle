# Monaco Editor Worker 配置（Vite 原生集成）

## 实现思路

monaco-editor 的语法高亮 / 语言服务（TS 校验、JSON 校验等）依赖 Web Worker。早期方案使用
`vite-plugin-monaco-editor` 插件（esbuild 打包 worker 到 `node_modules/.monaco`，dev 走中间件代理、build 注入 worker 路径），
已**移除**，改为 monaco-editor 官方 Vite 集成：用 Vite 原生 `?worker` 后缀导入 worker 模块，再通过
`self.MonacoEnvironment.getWorker` 按语言 label 分发。worker 由 Vite 直接打包，dev / build 行为一致。

## 关键文件与契约

| 文件 | 角色 |
|------|------|
| `../../src/renderer/src/plugin/monaco.ts` | 副作用模块：`?worker` 导入 5 个 worker + `self.MonacoEnvironment` 分发 |
| `src/renderer/src/components/view/MonacoEditorView.vue` | 唯一 monaco 使用方，顶部 `import '@/utils/monaco'` 保证环境先于 `editor.create` 生效 |
| `electron.vite.config.ts` | 已移除 `monacoEditorPlugin` 注册 |

`utils/monaco.ts` 的 label 分发表（与插件默认 `languageWorkers` 等价）：

| label | worker 文件 |
|-------|-------------|
| `json` | `monaco-editor/esm/vs/language/json/json.worker?worker` |
| `css` / `scss` / `less` | `monaco-editor/esm/vs/language/css/css.worker?worker` |
| `html` / `handlebars` / `razor` | `monaco-editor/esm/vs/language/html/html.worker?worker` |
| `typescript` / `javascript` | `monaco-editor/esm/vs/language/typescript/ts.worker?worker` |
| 其他（默认） | `monaco-editor/esm/vs/editor/editor.worker?worker` |

## 注意事项

- `?worker` 导入的类型声明依赖 `vite/client`（`src/renderer/src/vite-env.d.ts` 已引用），无需额外类型配置。
- 保留 `import * as monaco from 'monaco-editor'` 全量导入，仅替换 worker 加载方式，不涉及按需改造。
- electron-vite renderer 原生支持 `?worker`；`base: './'` 下 worker 产物以相对路径输出，asar 内正常加载。
- 新增 monaco 使用方时无需重复配置环境，`utils/monaco.ts` 为全局副作用，被引入一次即生效。
