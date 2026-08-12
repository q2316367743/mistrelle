# 订阅模块（subscribe）

> 项目内按「博主 → 视频订阅 → 详情」三级管理的订阅功能：策略解析链接、视频下载、ffmpeg 转音频、FunASR 转写、AI 总结。

## 目录结构

```
project/{pid}/subscribe/
├── index.json                # 博主索引 SubscribeBlogger[]
└── {bloggerId}               # 博主目录
    ├── index.json            # 该博主的视频订阅索引 SubscribeItem[]
    └── {subscribeId}         # 视频订阅目录
        ├── video.mp4         # 下载的视频（或仅音频源时只有 audio.mp3）
        ├── audio.mp3         # 视频提取的音频 / 直接下载的音频
        ├── text.md           # FunASR 转写文案
        └── summary.md        # AI 总结
```

两级 index.json 均为「索引即完整数据」模式（同 plan），目录内不再存单独 json。

## Entity（`src/entity/project/Subscribe.ts`）

- `SubscribeStatus`：`idle → downloading → ready → transcribing → transcribed → summarizing → summarized`，任一环节失败置 `error`（带 `error` 字段）。
- `SubscribeBlogger`：`name / avatar / url / platform / videoCount / recognize`。
- `SubscribeItem`：`title / cover / url / publishDate / description / videoUrl / audioUrl / status / error`。
- `SubscribeRecognizeSetting`：转写识别参数，博主级配置，该博主所有订阅转写时继承：
  - `language`：auto / zh / en / ja / ko / yue
  - `device`：cpu / cuda
  - `itn`：逆文本正则化（数字/标点还原）
  - `hotword`：热词

## 策略模块（`src/modules/subscribe/strategy/`）

**接口由本模块定义，具体平台实现由开发者自行编写。**

```ts
interface SubscribeStrategy {
  id: string
  label: string
  match(url: string): boolean
  // ① 视频详情链接 → 可下载资源
  resolveResource(url: string): Promise<SubscribeResource>
  // ② 博主主页链接 → 博主信息
  resolveBlogger(url: string): Promise<SubscribeBloggerResource>
  // ③ 博主主页链接 → 全部视频列表
  resolveBloggerVideos(url: string): Promise<SubscribeVideoResource[]>
}
```

- `registry.ts`：`registerSubscribeStrategy()` 注册，`resolveSubscribeResource/Blogger/BloggerVideos()` 按 `match` 分发（无匹配抛错）。
- `register.ts`：**开发者在此登记各平台实现**（抖音/快手/小红书/B 站），将实现文件加入 `strategies` 数组即可自动注册。
- 下载落盘用 `@/plugin/http` 的 `requestDownload`（走 `window.preload.net.downloadFileFromUrl`）。

## 转写（FunASR，`src/modules/subscribe/transcribe.ts`）

- 每次调用执行一次 python：`cliRun(pythonPath, [transcribe.py, audio, output, --language/--device/--itn/--hotword])`。
- `pythonPath` 取安全中心运行时配置（`useSettingSecureStore().pythonPath`，未配置兜底 `python3`）。
- 脚本以模板字符串内嵌于 `transcribeScript.ts`，首次使用写入 `~/.mistrelle/runtime/transcribe.py`（`ensureTranscribeScript`）。
- **注意**：python 冷启动快，慢在 FunASR 模型加载；`language` 参数仅对多语模型生效（脚本中非 zh 自动切 `paraformer`）。脚本为骨架，模型选型可按需调整。
- 识别参数由 `SubscribeService.subscribeTranscribe(projectId, bloggerId, subscribeId, blogger.recognize)` 透传。

## 总结（`src/modules/subscribe/summarize.ts`）

- 复用聊天能力，非流式 `chat.completions.create`（仿 `UseChatName`）。
- 模型：优先「默认总结模型」`defaultSummaryModel`，未配置兜底 `defaultQuickModel`（均见设置-默认设置）。
- 读取 text.md → 系统总结 prompt → 写 summary.md。

## 服务函数（`src/modules/subscribe/SubscribeService.ts`）

路径构建：

- `buildProjectSubscribeDir / buildProjectSubscribeIndexPath`
- `buildSubscribeBloggerDir / buildSubscribeVideoIndexPath / buildSubscribeVideoDir / buildSubscribeMediaPath`

博主 CRUD：

- `subscribeBloggerList / Save / Get / Add / Update / Remove`
- `subscribeBloggerAdd(projectId, url)`：`resolveBlogger` → 建目录骨架 → 写索引；视频列表由页面随后调 `subscribeBloggerSyncVideos` 拉取。

视频 CRUD：

- `subscribeVideoList / Save / Remove`
- `subscribeBloggerSyncVideos(projectId, bloggerId)`：`resolveBloggerVideos` → 按 url 去重合并（保留本地已存在条目）→ 更新索引与博主 `videoCount`。

流水线（幂等、可独立触发、失败置 `error`）：

- `subscribeDownload`：`resolveResource` 取直链 → 下载 video.mp4；仅音频源直接存 audio.mp3；视频源无音频直链时下载后立即提取音频。
- `subscribeExtractAudio`：`inject.ffmpeg.run([... -vn -acodec libmp3lame ...])`。
- `subscribeTranscribe`：FunASR，透传博主识别参数。
- `subscribeSummarize`：AI 总结。
- `subscribeProcessItem`：一键串起以上四步。

工具：`subscribeMediaExists` / `subscribeFileHref`（`window.preload.net.pathToHref`，供 `<video>`/`<audio>` 播放）。

## UI（`src/pages/project/subscribe/`）

- `SubscribePage.vue`：左固定博主列表 + 右侧主从切换（列表 ⇄ 详情）。
- `components/BloggerList.vue`：头像 + 名字 + N 条笔记，hover 出现「识别设置」。
- `components/SubscribeListView.vue`：封面 + 订阅名称 + 发布日期 + 状态 tag；右上「同步视频」。
- `components/SubscribeDetail.vue`：订阅名称、`<video>`/`<audio>` 内嵌播放器、总结 md 预览、`t-collapse` 折叠转写文案、操作按钮（一键处理/下载/提取音频/转写/总结/打开目录/删除订阅）。
- `modals/BloggerPutDialog.tsx` + `BloggerPutContent.vue`：粘贴链接 → 解析博主信息预览 → 添加。
- `modals/BloggerSettingDialog.tsx` + `BloggerSettingContent.vue`：博主识别参数（语言/设备/itn/热词）。

弹窗遵循约定：`.tsx` 命令式外壳（`DialogPlugin`，`footer: false`）+ `.vue` 内容组件（`emit('close'/'success')`）。

封面/头像为网络 URL，渲染时加 `referrerpolicy="no-referrer"` 规避防盗链。

## 注意事项

- 平台热链防盗：封面/头像外链可能 403，必要时策略实现侧自行下载转存。
- 转写为自动任务，识别参数仅博主级，不做单条订阅覆盖。
- 模型加载耗时：FunASR 每次执行都会重新加载模型，若后续体验不佳可改为常驻进程方案。
