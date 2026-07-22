# AGENTS.md —— 前端工程约束规范

## 🚫 硬性红线（违反即错）

| 编号    | 规则                                                   |
|-------|------------------------------------------------------|
| RL‑01 | 语言：允许英文思考，但所有对外输出必须使用中文                              |
| RL‑02 | 根目录洁净：禁止在根目录放置业务代码                                   |
| RL‑04 | 类型安全：禁止使用 `any`；禁止不必要的 `as` 断言                       |
| RL‑05 | UI 强制：所有 UI 元素必须使用 `tdesign`；禁用原生 `alert` / `select` |
| RL‑06 | 文件长度：vue 文件 ≤ 300 行，ts 文件 ≤ 500 行，超出必须拆分             |

---

## ⚙️ 编码原则

1. **方案先行**

- 需求模糊时必须提问，不做假设
- 存在多种理解时，全部列出后再确认

2. **简洁至上**

- 用最少代码解决问题
- 自检：「一位资深工程师会觉得这段代码过度设计吗？」

3. **精准修改**

- 只改必须改的部分，保持既有代码风格
- 只清理本次改动产生的孤儿代码

4. **目标驱动**

- 将任务拆成可验证目标（如：`加校验 → 先写非法输入失败用例 → 让用例通过`）

5. **红线优先**

- 上述原则与硬性红线冲突时，以红线为准

6. **关键逻辑注释**

- 复杂算法、同步流程、冲突处理、锁处理必须为入口函数补充 JSDoc
- 关键分支必须添加简短备注，说明为什么这样处理，而不是复述代码做了什么

---

## 🔗 组件与方法设计约束（高内聚 · 低耦合）

开发组件 / 方法时，必须保持高内聚、低耦合，避免把本属于组件自身的数据与状态外泄：

1. **数据随事件流出，而非被反向拉取**

- 组件在 `emit` 时，应把本次操作所需的完整数据作为 **payload 直接带出**（如 `emit('send', payload)`）。
- 禁止：父组件通过 `ref` 调用子组件暴露的 `getXxx()` 把数据「拉」回来再处理——这迫使每个使用者都重复一遍取数逻辑，且必须了解子组件内部接口。

2. **自身状态自身管理**

- 组件拥有自己的输入、选中态等，应在完成动作后 **自行清空/复位**（如发送后清空编辑器）。
- 禁止：子组件 `emit` 一个空事件，再由父组件回头调用 `clearXxx()` 去清子组件状态。

3. **方法签名以数据为中心**

- 跨层传递数据时，优先传「已经结构化好的数据对象」，而非零散字段让调用方拼装。

---

## 🧩 技术选型与设计约定

1. **UI 组件与图标**

- 统一使用 `tdesign` 组件库及图标，关于组件用法，使用 `tdesign-mcp-server` 这个 mcp 查看
- 禁止手写 SVG，除非 `tdesign` 未提供对应图标

2. **设计风格**

- 采用 **Fluent Design** 设计风格
- 强调层级、阴影、动效的自然流畅

3. **样式管理**

- 布局与尺寸可使用 `unocss`（如 `flex`、`m-8px`）
- 颜色类必须使用 `tdesign` 的 CSS Token，禁止直接使用裸色值

4. **弹窗与抽屉**

- 弹窗 / 抽屉必须使用 `.tsx` 实现
- 其余场景一律使用 `.vue` 组件

5. **组件存放规则**

- 非公共组件：放在当前页面目录下的 `components/`
- 通用组件：才可放入 `src/components/`
- 禁止将业务组件直接放入 `src/components`

---

## 📁 目录结构示例 + 错误示例对照表

### ✅ 推荐目录结构

```text
src/
├── api/
│   └── user.ts
├── pages/
│   └── dashboard/
│       ├── index.vue
│       ├── components/
│       │   └── StatCard.vue
│       └── modals/
│           └── FilterDrawer.tsx
├── components/
│   └── BaseTable.vue
```

### ❌ 错误示例与原因

| 错误示例                              | 原因                                  |
|-----------------------------------|-------------------------------------|
| `src/UserList.vue`                | 违反 RL‑03，业务代码不应放在根目录                |
| `pages/dashboard/api.ts`          | 违反 RL‑04，API 必须集中在 `@/api`          |
| `components/OrderDetailModal.vue` | 违反组件存放规则，非通用组件不应放在 `src/components` |
| 页面中直接使用 `fetch('/api/user')`      | 违反 RL‑04，绕过 `@/api`                 |
| 使用 `<select>` 或 `alert()`         | 违反 RL‑06，必须使用 `tdesign`             |
| 手写 SVG 图标                         | 违反 UI 约定，应使用 `tdesign` 图标           |
| `const data: any = res.data`      | 违反 RL‑05，禁止 `any`                   |
| `color: #1677ff;`                 | 违反样式约定，应使用 tdesign CSS Token        |
| `FilterModal.vue` 作为弹窗            | 违反约定，弹窗 / 抽屉必须使用 `.tsx`             |
| 单文件超过 300 行未拆分                    | 违反 RL‑07                            |
| 父组件用 `ref` 调子组件 `getXxx()` 反向拉取本应随事件带出的数据 | 违反低耦合：使用者被迫了解子组件内部接口，且每个消费者都要重写取数逻辑 |
| 子组件 `emit` 空事件，由父组件回头 `clearXxx()` 清子组件状态 | 违反高内聚：组件应自行管理自身状态（如发送后清空自身输入） |

## DialogPlugin 使用示例

```tsx
import { DialogPlugin } from "tdesign-vue-next";
export const postAiGroupDialog = () => {
  const name = ref("");
  const dp = DialogPlugin({
    header: "创建分组",
    confirmBtn: "创建",
    placement: "center",
    default: () => (
      <div class={"px-4px"}>
        <input v-model={name.value} />
      </div>
    ),
    onConfirm: () => {
    },
  });
};
```
## DrawerPlugin 使用示例

```tsx
import { DrawerPlugin } from "tdesign-vue-next";
export const postAiGroupDialog = () => {
  const name = ref("");
  const dp = DrawerPlugin({
    header: "创建分组",
    confirmBtn: "创建",
    default: () => (
      <div class={"px-4px"}>
        <input v-model={name.value} />
      </div>
    ),
    onConfirm: () => {
    },
  });
};
```
