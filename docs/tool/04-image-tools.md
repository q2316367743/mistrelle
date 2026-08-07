# 生图与裁剪工具（image_generate / image_crop）

> design 对话注入的 2 个图片处理工具：生图（依赖默认生图模型，多素材合并省钱）+ 本地裁剪（uTools Sharp）。
> 定位：解决「AI 无插画素材 / 想省生图成本」——需要多素材时拼一张 sprite 一次生成，再本地切分。

> 关键文件：
>
> - 工具工厂 `src/modules/tool/components/design/index.ts`
> - 生图工具 `src/modules/tool/components/design/imageGenerate.ts`
> - 裁剪工具 `src/modules/tool/components/design/imageCrop.ts`
> - 生图服务封装 `src/modules/chat/service/ImageGenerate.ts`（已实现，接口自适应）
> - Sharp 包装 `src-utools/src/inject.js`（inject.sharp）+ 类型 `src/types/inject.d.ts`
> - 省钱指南 `src/modules/tool/components/canvas/guidelines/image-generation.md`
> - 注入点 `src/global/ChatTypeConfig.ts`（design 配置）

---

## 1. 工具契约

### `image_generate`（文字生图，写沙盒）

| 项       | 值                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 参数     | `prompt`（必填，建议详细英文描述）+ `path?`（输出路径，缺省沙盒 `outputs/images/image-{时间戳}.png`）+ `size?`（如 `1024x1024`） |
| 返回成功 | `{ success, path, width?, height? }`                                                                                             |
| 返回失败 | `{ error }`（未配置模型 / 模型无效 / 接口失败 / 缺 prompt）                                                                      |
| 风险     | sensitive，注册路径感知策略（沙盒 / 工作空间内放行）                                                                             |
| 注入条件 | 仅当「默认生图模型」（设置 → 默认设置）已配置时注入                                                                              |

- 真实生图逻辑收口在 `generateImage({ prompt, path, size? })`（`src/modules/chat/service/ImageGenerate.ts`）。
  流程：`defaultImageModel` → `useSettingAiStore().optionMap` 解析 `baseUrl/key/model` →
  `POST {baseUrl}/images/generations`（走 `@/plugin/http`，随全局代理/UA/超时设置）→ 落盘。
- 工具从具体文件路径导入 `generateImage`（叶子模块），不经过 chat 桶文件，避免循环依赖。

### 生图接口自适应（不同中转站返回不同）

`POST /v1/images/generations` 同一 endpoint 在中转站间返回形态不同，实现按响应内容自动适配：

| 返回形态                                           | 代表中转站                        | 处理                                                                             |
| -------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `{ created, data:[{ url }] }`                      | OpenAI 同步（dall-e 默认）        | 直接取 `data[0].url` 下载落盘                                                    |
| `{ created, data:[{ b64_json }] }`                 | OpenAI 同步（gpt-image 系列默认） | 直接取 `data[0].b64_json`，strip data URI 前缀后 `atob` 写盘                     |
| `{ code, data:[{ status:'submitted', task_id }] }` | apimart GPT-Image-2 等异步        | 轮询 `GET {baseUrl}/tasks/{task_id}`，`completed` 后取 `result.images[0].url[0]` |

- **轮询参数**：每 3s 一次，最多 100 次（≈5 分钟）；请求异常与 `failed` / `cancelled` 状态
  **连续 5 次确认失败**才返回其 `error.message`（容错中转站偶发抖动 / 状态闪烁），中途任何有效任务响应即清零连续失败计数。
- **错误提取**：axios 抛错（`error.response.data.error.message` / `message` / HTTP 状态）与 2xx 但顶层
  `error` / `code!==200` 均兜底为可读中文错误。
- **size**：缺省补 `1024x1024`（部分中转站如 V-API gpt-image 系列强制要求 size，该值全模型通用）；
  显式传入则原样透传（`1024x1024` 两套接口均兼容，apimart 也支持像素直传）。
- **落盘**：先 `mkdir(dirname,true)`；URL 走 `requestDownload`（随代理），base64 走 `fs.writeBinaryFile`。
- **宽高**：落盘后优先 `inject.sharp.metadata(path)` 读真实尺寸（uTools 环境），回退从 `size` 正则解析。

### `image_crop`（本地裁剪，不耗模型）

| 项       | 值                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| 参数     | `path`（源图）+ `regions[]`（x/y/width/height）**或** `grid{cols,rows,gap?}` + `outDir?`（缺省源图同目录） |
| 返回成功 | `{ success, source:{path,width,height}, images:[{index,path,width,height}] }`                              |
| 返回失败 | `{ error }`                                                                                                |
| 风险     | sensitive，路径感知策略（源图 / 输出目录限沙盒 / 工作空间 / 主目录）                                       |

- 基于 **uTools 内置 Sharp**：`src-utools/src/inject.js` 包装为 `inject.sharp.metadata(input)` /
  `inject.sharp.crop(input, region, output)`（底层 `.extract().png().toFile()`）；ZTools / browser 环境
  缺失（undefined），工具判空报错。
- `grid` 等分：`cellW = floor((W − gap×(cols−1)) / cols)`，末行 / 末列吸收余量保证全覆盖；
  `regions` 显式区域自动取整并钳制到图片边界内。

## 2. 与 canvas / 指南的关系

- 产出 path 填进画布 `image` 节点 `imageUrl` 使用。
- `canvas_guidelines("image-generation")` 内建省钱规范：**多个素材合并一张 sprite 一次生成 → image_crop
  切分**（1 次生图换 N 素材，裁剪本地免费）。
- canvas 的 `image` 操作 `ai` 类型仍按 stock 兜底（未接入 image_generate），不在本次范围。

## 3. 注意事项

- 未配置默认生图模型或模型无效时工具返回明确 error，AI 应如实告知用户并回退 stock / placeholder / 用户素材。
- 接口返回无法识别（无 url / b64_json / task_id）时同样返回明确 error，避免静默失败。
- image_generate 只在配置默认生图模型后注入；未配置时模型上下文里看不到该工具，不会误调用。
- 裁剪输出固定 PNG；多张输出按 `{basename}_crop_{index}.png` 命名。
