# 设计素材工具（website_logo / icon_svg）

> 设计类对话（design chat）注入的 2 个素材获取工具，与 canvas 画布解耦。
> 定位：解决「AI 不上网拿真实素材」——logo 用官网真实图标、图标用真实 SVG，
> 禁止自己画近似 logo / 凭空编图片 URL。
>
> 关键文件：
> - 工具工厂 `src/modules/tool/components/design/index.ts`
> - 图标工具 `src/modules/tool/components/design/iconSvg.ts`
> - logo 工具 `src/modules/tool/components/design/websiteLogo.ts`
> - 来源适配器 + 打分 `src/modules/tool/components/design/faviconSources.ts`
> - 注入点 `src/global/ChatTypeConfig.ts`（design 配置）

---

## 1. 工具契约

### `website_logo`（获取网站图标，写沙盒）

| 项 | 值 |
|---|---|
| 参数 | `url`：网站地址或域名（如 `https://www.google.com` / `github.com`） |
| 返回成功 | `{ success, domain, path, href, format, note }` |
| 返回失败 | `{ error }`（所有来源失败时的干净提示） |
| 风险 | sensitive，注册自动放行策略（只写沙盒 outputs/images/，不接收用户路径） |

- 内部自动提取域名，按打分降序尝试多个来源（每个来源即一个下载策略），**第一个成功即返回**。
- 落盘路径：`{sandboxDir}/outputs/images/logo-{domain}.{ext}`（ext 由来源声明的 format 决定）。
- AI 拿到 `path` / `href` 后填进画布 `image` 节点的 `imageUrl` 使用。

### `icon_svg`（获取 SVG 图标，只读）

| 项 | 值 |
|---|---|
| 参数 | `name`（`{集合}:{名称}`，如 `mdi:home`）**或** `query`（关键词）+ `color?`（如 `#E63946`） |
| 返回成功(name) | `{ success, name, svg }`（内联 SVG 字符串） |
| 返回成功(query) | `{ success, query, icons: ["mdi:home", …], total }`（候选图标名） |
| 返回失败 | `{ error }` |
| 风险 | safe（只读） |

- 数据源：**Iconify**（`api.iconify.design`），聚合 Material / Feather / Lucide / Tabler /
  Font Awesome 等全部开源图标库，免费开放——是 iconfont（无免费 API）的替代方案。
- AI 把返回的 `svg` 字符串填进画布 `svg` 节点；单色图标把内部颜色写成 `$token名`
  即可跟随调色板（见 canvas 侧 `$token` 替换）。

## 2. 来源适配器与打分机制（faviconSources.ts）

### 来源表（各来源返回格式不同，需分别适配）

| id | URL 模板 | format（落盘扩展名） |
|---|---|---|
| `favicon-im` | `https://a.favicon.im/{domain}` | svg |
| `faviconsnap` | `https://faviconsnap.com/api/favicon?url={domain}` | ico |
| `google-s2` | `https://www.google.com/s2/favicons?domain={domain}&sz=128` | png |
| `duckduckgo` | `https://icons.duckduckgo.com/ip3/{domain}.ico` | ico |

### 打分机制

- 每个来源初始 `100` 分，上限 `100`、下限 `0`。
- **失败**（下载抛错 / 文件为空）→ 扣 `20` 分；**成功** → 加 `5` 分。
- 尝试顺序按分数**降序**：坏来源被持续降权靠后，减少对失效接口的重复请求。
- 分数持久化到 `localStorage`（key `mistrelle:design:source-score`），跨会话生效；
  无 window 环境退回内存 Map。
- 下载方式：来源即策略，直接用 `downloadFileFromUrl` 下载（HTTP 非 2xx 抛错），
  不解析 / 不校验返回内容——下载失败即扣分并尝试下一来源。

## 3. 与 canvas 的关系

- 工具本身与 canvas 无关（只负责获取素材），但产出的 path / SVG 字符串被画布消费。
- 画布侧配套能力（见 `docs/canvas/02-canvas-node-model.md`）：
  - `image` 操作新增 `web` 类型：AI 自发现的真实图片（og:image / banner 等）一步落盘沙盒。
  - `svg` 节点内联字符串支持 `$token名` 调色板替换（insert / copy / update 时落盘为实色）。

## 4. 注意事项

- 服务为第三方免费接口，可能限流 / 变更 / 下线——靠打分机制自适应降权，不硬编码信任某个来源。
- 网络被安全中心全禁时，下载会失败并返回 `{ error }`，AI 应如实告知用户并提供替代方案。
- `icon_svg` 的 `color` 参数仅接受真实色值；`$token` 调色板引用不传给远端，直接写进 svg 节点即可。
- 扩展来源只需在 `FAVICON_SOURCES` 追加一项（声明 id / format / buildUrl），打分机制自动接管。
