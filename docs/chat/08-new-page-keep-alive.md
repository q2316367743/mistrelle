# 新建聊天页 keep-alive 保活（PageNew）

> 「新建聊天」页（`/new`）在 `App.vue` 的 `router-view` 外套 `keep-alive` 保活：切到聊天页等其他页面再返回时，已选的类型 / 场景 / 模型 / 输入内容不丢失；点击发送后立即重置全部页面数据，保证返回本页时是干净状态。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/App.vue` | `router-view` 改用 `v-slot` 插槽 + `keep-alive :include="['PageNew']"` 缓存新建聊天页 |
| `src/renderer/src/pages/new/PageNew.vue` | `defineOptions({ name: 'PageNew' })` 显式组件名（keep-alive 匹配依据）；发送成功后调用 `resetPageData()` 重置全部数据 |

## 实现要点

### keep-alive 挂载（App.vue）

```vue
<router-view v-slot="{ Component }">
  <keep-alive :include="keepAliveNames">
    <component :is="Component" />
  </keep-alive>
</router-view>
```

- `keepAliveNames = ['PageNew']`：仅缓存新建聊天页，其余页面仍走默认挂载/卸载（聊天室等每次进入保持新状态）。
- `include` 匹配的是**组件名**，因此 `PageNew.vue` 用 `defineOptions({ name: 'PageNew' })` 显式声明，不依赖文件名推断。
- 侧边栏 `AppSide`、顶栏 `common-operator`、路由结构均保持原样，仅增加保活层。

### 发送后重置（PageNew.handleSend）

- 发送流程不变：`useAiChatStore().add(...)` 创建聊天记录 → `router.push('/chat/:id')` → `toggleCollapsed(true)`。
- 因页面被保活（不会随跳转卸载），在 `router.push` 前调用 `resetPageData()`，重置字段与初始值：

| 字段 | 重置值 | 说明 |
|------|--------|------|
| `type` | `'office'` | 聊天类型 |
| `scene` | `'article'` | 写作场景 |
| `designStyleId` | `''` | 设计风格 id（`watch(type)` 亦会在非 design 时自动清空） |
| `model` | `defaultAssistantModel` | 默认模型（取 `useSettingDefaultStore().state.defaultAssistantModel`） |

- 输入框内容：`LChatSender` 发送成功后内部自行 `clear()`（清空编辑器与 mention 状态），无需页面侧处理。
- 重置后 `:initial="{ model, type, writingScene: scene }"` 对象引用变化，`LChatSender` 通过 `watch(initial)` 将新类型 / 场景 / 模型同步到发送器内部状态。

## 注意事项

- keep-alive 缓存的是内存状态，应用重启后页面数据自然清空（无需持久化）。
- 若未来需要保活更多页面，把对应组件名追加到 `keepAliveNames` 即可；注意被缓存的页面会跳过 `onMounted`（仅首次），依赖每次进入都刷新的逻辑应改挂 `onActivated`。
