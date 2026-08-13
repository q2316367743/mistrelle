# 浏览器工具 CSS 选择器提取支持

## 背景

`browser_fetch` 与 `browser_actions` 的 `getHtml` / `getText` 原先只能全量提取页面内容（`document.body.innerText` /
`document.documentElement.outerHTML`），长页面会占用大量 AI 上下文 token。

本功能为三者新增 **可选** CSS 选择器参数，让 AI 只提取目标区块，节省上下文。

## 实现思路

- 保持参数可选：不传 selector 时行为与之前完全一致，向后兼容。
- `markdown` 模式：fetch 载荷带 selector 时，main 的 `BrowserToolRunner` 先用页内 `extractHtml(selector)`
  取元素 HTML，再 turndown 转换（`src/main/src/browserTool/pageScripts.ts`）。
- `text` / `html` 模式：main 内执行页内 `extractHtml` / `extractText`：传入 selector 则
  `document.querySelector` 取目标元素，否则回落全量。
- **空结果防护**：`querySelector` 匹配为空时页内函数显式 `throw`，错误经 `runBrowser` 的 Promise reject
  反馈给 AI，AI 可修正选择器重试。刻意**不**做"匹配空自动降级全量"，避免掩盖错误、破坏省 token 目的。
- 提取逻辑为 main 侧共享函数 `extractHtml` / `extractText`（`src/main/src/browserTool/pageScripts.ts`）。

## 关键文件

- `src/modules/tool/components/native/browserFetch.ts`（fetch 载荷）
- `src/modules/tool/components/native/browserAutomation.ts`（getHtml / getText 步骤）
- `src/main/src/browserTool/runner.ts` + `pageScripts.ts`（步骤解释与页内提取，见 `docs/browserTool/01-browser-tool.md`）

## API 契约

### browser_fetch

新增可选参数 `selector: string`：

| mode     | selector 存在时                     | selector 缺失时                      |
|----------|-------------------------------------|--------------------------------------|
| markdown | `markdown(selector)`（底层透传）    | 全量 markdown                        |
| text     | `querySelector(selector).innerText` | `document.body.innerText`            |
| html     | `querySelector(selector).outerHTML` | `document.documentElement.outerHTML` |

### browser_actions

`getHtml` / `getText` step 新增可选字段 `selector`，语义同上。其余 step 不变。

### 错误约定

selector 匹配不到元素时抛错：`CSS 选择器 "${sel}" 未匹配到任何元素`（evaluate 内 throw，`run()` reject 透传）。

## 注意事项

- `document.querySelector` 返回 `Element | null`，`innerText` 仅存在于 `HTMLElement`，需 `as HTMLElement | null` 断言（必要断言，非
  `any`）。
- evaluate 函数会被序列化到页面执行，外部闭包不可用，selector 必须经函数参数传入。
- 工具 description 与 schema 描述已同步引导 AI 何时使用 selector（长页面 + 已知目标元素时）。
