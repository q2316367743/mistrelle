# 02 对话侧边定位器（RChatList Locator）

> 对话右侧竖排的消息定位指示器：仅展示用户消息，hover 时通过 tooltip 预览该消息前 10 个字。

## 实现思路

`src/components/chat/RChatList.vue` 的 `r-chat-list__locator-group` 原先是每条消息（用户 + 助手）都渲染一个定位按钮，
tooltip 为固定文案「定位到这条消息」。改为：

- 仅对**用户消息**渲染定位按钮（助手消息由滚动本身即可定位，无需侧边指示）；
- tooltip 展示该用户消息的内容预览：前 10 个字，超出补省略号「…」。

## 关键实现

```ts
const userMessages = computed(() =>
  props.messages.filter((message): message is UserMessage => message.role === 'user')
)

const LOCATOR_TEXT_MAX = 10

const getLocatorTooltip = (message: UserMessage) => {
  const fallback = message.content
    .map((item) => {
      if (item.type === 'skill') return item.data.name
      if (item.type === 'tool') return item.data.label
      if (item.type === 'attachment') return item.data.map((file) => file.name ?? '').join(', ')
      return ''
    })
    .filter(Boolean)
    .join(', ')
  const text = message.content.find((item) => item.type === 'text')?.data || fallback

  return text.length > LOCATOR_TEXT_MAX ? `${text.slice(0, LOCATOR_TEXT_MAX)}…` : text
}
```

## 数据结构 / 契约

- 文本预览优先级：`content` 中 `type === 'text'` 的 `data`（string）；
- 无文本（纯 skill / tool / attachment 消息）时回退拼接内容名称：skill→`name`、tool→`label`、attachment→文件 `name`（逗号拼接），
  避免出现空 tooltip；
- 截断：`length > 10` 时取前 10 个字符并追加「…」（字符级，非字节）。

## 注意事项

- 文本类型属于 `UserMessageContent` 联合（`TextContent | AttachmentContent | SkillContent | ToolContent`），
  取非 text 分支时必须**分类型判断**（`item.type === 'skill'` 与 `item.type === 'tool'` 分开），
  因为 `SkillItem` 只有 `name`、`ToolItem` 只有 `label`，复合条件 `'skill' || 'tool'` 下 TS 无法收窄 `data`。
- `??` 与 `||` 混用会触发 TS5076，需加括号或拆分变量（当前实现拆成 `fallback` + `text` 两步）。
- 原 `.r-chat-list__locator--assistant` 样式已随本次改动删除（孤儿代码）。
