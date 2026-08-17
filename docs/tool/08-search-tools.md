# 搜索工具：zhihu_search 与 any_search

## 背景

对话默认工具集需要站内 / 全网检索能力：知乎站内内容走官方开放平台；通用与垂直域检索走 AnySearch。

二者均为只读网络查询，标 `risk: 'safe'`。经 `getDefaultTools()` 动态注入：`any_search` 始终可用；`zhihu_search` 仅在账号配置了 Access Secret 时加入。

## 实现思路

- 单文件 `native/search.ts` 导出 `getNativeSearchTools()`（按配置组装）。
- `defaultTools` 改为方法 `getDefaultTools()`，避免静态数组无法按账号配置裁剪。
- HTTP 走 `@/plugin/http` 的 `requestJson`（preload Node 通道，免疫 CORS）。
- 域名遵守安全中心沙盒策略（`isDomainBlocked`），与 `nativeHttpTools` / context7 一致。
- 知乎鉴权密钥存 `SettingAccount.zhihu`；请求时由 `SettingAccountStore.zhihuConfig()` 生成 `Authorization` + 秒级 `X-Request-Timestamp`（时间戳必须每次现取）。

## 关键文件

- `src/renderer/src/modules/tool/components/native/search.ts` — 工具定义 + `getNativeSearchTools()`
- `src/renderer/src/modules/tool/index.ts` — `getDefaultTools()` 动态组装
- `src/renderer/src/entity/setting/SettingAccount.ts` — `zhihu` 字段
- `src/renderer/src/store/setting/SettingAccountStore.ts` — `zhihuConfig()`
- `src/renderer/src/pages/setting/account/SettingAccountPage.vue` — 「知乎数据开放平台」配置项，「获取」打开 https://developer.zhihu.com/

## API 契约

### zhihu_search

上游：`GET https://developer.zhihu.com/api/v1/content/zhihu_search`

输入：

| 字段 | 必填 | 说明 |
|------|------|------|
| `query` | 是 | 查询关键词 |
| `count` | 否 | 条数，默认 10，最大 10 |

未配置 Access Secret 时**不注入**本工具（模型侧看不到），无需运行时再报错。

成功输出（精简字段）：`hasMore`、`searchHashId`、`emptyReason?`、`count`、`items[]`（title / contentType / contentText / url / voteUpCount 等）。

### any_search

上游：`POST https://api.anysearch.com/v1/search`

鉴权：当前实现走**匿名**（不传 Authorization）。匿名有 IP 日额度与限流；后续若需付费额度可再加账号设置项。

输入：

| 字段 | 必填 | 说明 |
|------|------|------|
| `query` | 是 | 自然语言查询，单次单一意图 |
| `max_results` | 否 | 1–20，默认 10 |
| `tag` | 否 | 能力标签，如 `code.doc`、`general.general` |
| `zone` | 否 | `cn` / `intl` |
| `language` | 否 | 如 `zh-CN` |
| `params` | 否 | tag 扩展参数，勿臆造键 |
| `format` | 否 | `json` / `markdown` |

成功输出：`requestId`、`metadata`、`count`、`results[]`（title / url / snippet / content）。

## 注意事项

- 知乎 `X-Request-Timestamp` 必须为秒级 Unix 时间戳，且每次请求重新生成。
- AnySearch 若日后配置了无效 key，网关返回 401/403，**不会**静默回退匿名；因此当前刻意不传空 Bearer。
- 存量用户本地无 `zhihu` 字段时，store 读入后缺省为空串，此时不注入 `zhihu_search`。
- 调用方勿长期缓存 `getDefaultTools()` 返回值；每次组装工具列表时重新调用。
