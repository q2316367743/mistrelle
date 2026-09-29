# 小红书图文笔记定时发布（ego 浏览器）

把已定稿的图文笔记（封面 + 内页卡片 + 标题 + 正文）上传到小红书创作服务平台（creator.xiaohongshu.com）并定时发布。

> 本文所有选择器与坐标法均来自 2026-09-29 一次真实发布的实测记录（5 张 1080×1440 卡片，定时到次日中午 12:00），当时逐条通过。平台改版后选择器可能失效——失效时重新探测页面，不要硬套本文的写法。

## 0. 一条铁律先记住

**必须先打开「定时发布」开关，日期时间输入框才会出现。**

顺序反了会卡死：开关关着时页面上根本不存在那个日期框，任何选择器都找不到它。

正确顺序：传图 → 填标题 → 填正文 → 开定时开关 → 设时间 → 提交。

## 1. 适用与不适用

**适用**
- 图文笔记（图片 + 标题 + 正文）的发布与定时发布
- 图片在本地、需要一次上传多张

**不适用**
- 视频笔记、长文、播客
- 需要挂商品、地点、合集等复杂设置的场景
- 平台内的其他动作（改已发布笔记、素材库管理、数据下载）

## 2. 工具前置（本项目）

发布经由 `ego_browser_run` 驱动本机 ego-browser（复用用户已登录的浏览器环境）。开工前按顺序做完这四件事：

1. **装载工具组**：`load_tool_collection(["browser"])`。`ego_browser_run` / `ego_browser_exist` 不在常驻工具里（凭记忆直呼虽有自动装载兜底，但先显式装载更稳，避免多绕一轮）。
2. **探测环境**：`ego_browser_exist`。未安装（`installed: false`）就停下告知用户，指引他去「设置 → 安全中心 → 内置运行时 → ego-browser」配置路径，不要改用别的方案硬试。
3. **给足超时**：一次完整发布的固定等待合计 40 秒以上（上传 12s、提交 9s、各步 2.5~6s）。`ego_browser_run` 的 `timeout` 默认只有 30 秒，**每段调用都要显式传**（建议 ≥ 180000）。
4. **按段拆调用**：每次 `ego_browser_run` 都是一个**新进程**——JS 变量不保留，但任务空间、标签页与页码标签（`p1`）保留。所以把流程拆成三段，段与段之间用上一段 `console.log` 打印的 `spaceId` 走 `taskSpace(spaceId)` 续用**同一个**空间：
   - 段 ①：建空间 + 核对账号身份
   - 段 ②：进发布页 + 批量传图 + 标题 + 正文
   - 段 ③：开定时开关 + 设时间 + 提交 + 验收

**脚本 API 说明**：ego-browser 有一套自己的精简 API（`taskSpace` / `task.page` / `page.*` / `task.finish` / `takeOverTaskSpace`），**不是 Playwright**。只允许用这类已文档化的方法；不要写 `locator()` / `getByRole()` / `context()` / `expect()` 这类臆造方法。脚本运行在 Node 环境，页面里的 `document` 只能在 `page.evaluate()` 里访问；关键状态一律 `console.log()` 打印，再从工具返回的 `stdout` 里读。

## 3. 发布前：素材与账号核对

| 项 | 要求 | 检查方式 |
|---|---|---|
| 用户授权 | 用户明确要求发布 | 未明确要求不发起；一次只发一篇 |
| 登录态 | Creator 平台已登录 | 打开首页，右上角应显示账号名 |
| 账号身份 | 与用户自己的工作记录一致 | 笔记管理的历史标题 / 时间戳，与工作空间里的发布台账（如 `发布台账.md`）逐条对照 |
| 图片规格 | 3:4 到 2:1，分辨率 ≥720×960，单张 ≤32MB，png/jpg/jpeg/webp | 卡片常规产出 1080×1440 |
| 图片命名 | `P01_封面.png` 起顺序编号 | 上传顺序即笔记页序，P01 自动成为封面 |
| 图片张数 | ≤ 18 张 | 上传后页面显示「图片编辑 N/18」 |
| 图片清单 | 文件真实存在 | 上传前用 `file_glob` / `file_list` 核对目录与顺序 |
| 浏览器权限弹窗 | 必须由用户亲自处理 | 见第五节坑一 |

**账号身份核对不能省。** 发布是不可逆动作，发错号的代价远大于多花十秒核对。核对方法是把笔记管理里的历史标题与用户自己的台账 / 既往记录逐条对照，对不上就停下来问用户，不要猜。

**图片清单来源**：优先用画板导出的成品图目录（工作空间里通常形如 `{workspace}/选题/<主题>/P01_封面.png`，或本聊天画板 `canvas_export` 的落点）。用户没指明目录时先问清；拿到目录后先列文件核对「张数、顺序、封面是 P01」，再动上传。

**发布前必须让用户确认一次**（用 `ask` 工具，别口头带过）：发布账号 / 标题 / 图片张数 / 正文首句 / 定时时间。用户没给发布时间就问，不要替他定。

## 4. 分步流程

以下脚本片段都是 `ego_browser_run` 的 `script` 参数内容（`subcommand: "nodejs"`）。

### 段 ① · 建任务空间并核对身份

```js
const task = await taskSpace("发布小红书笔记");
const page = task.page("p1");
console.log(`spaceId=${task.spaceId}`);
await page.goto("https://creator.xiaohongshu.com/new/note-manager?source=official");
await page.waitForLoadState();
await page.waitForTimeout(6000);
console.log((await page.evaluate(() =>
  (document.body.innerText || "").replace(/\n{2,}/g, "\n").slice(0, 1200))));
```

判据是列表里出现台账中最近几篇的标题与时间戳。**对不上就停下来问用户，不要继续。**

核对通过、用户确认素材与时间后，再走段 ②。

### 段 ② · 进发布页 → 批量传图 → 标题 → 正文

```js
const task = await taskSpace(7);           // 换成段 ① 打印的 spaceId（数字）
const page = task.page("p1");

// 2.1 进入发布页
await page.goto("https://creator.xiaohongshu.com/new/home?source=official");
await page.waitForLoadState();
await page.waitForTimeout(2500);
await page.click('text="发布图文笔记"');    // 会跳到 /publish/publish?target=image
await page.waitForTimeout(6000);
console.log(await page.url());

// 2.2 批量上传图片（一次多选、按数组顺序传，P01 自动成为封面，不要逐张传）
const dir = "/绝对路径/选题目录";
const files = ["P01_封面.png", "P02_xxx.png", "P03_xxx.png", "P04_xxx.png", "P05_xxx.png"]
  .map((n) => `${dir}/${n}`);
await page.setInputFiles('input[type="file"]', files);
await page.waitForTimeout(12000);
console.log((await page.evaluate(() =>
  (document.body.innerText || "").match(/图片编辑\s*\d+\/\d+/)?.[0] ?? "未找到图片编辑计数")));

// 2.3 填标题（上限 20 字）
await page.fill('input[placeholder="填写标题会有更多赞哦"]', title);
await page.waitForTimeout(1000);

// 2.4 填正文（上限 1000 字；contenteditable 富文本区用 paste 比 fill 稳）
await page.click('div[contenteditable="true"]');
await page.waitForTimeout(400);
await page.keyboard.paste({ text: body });
await page.waitForTimeout(3000);
```

要点
- 页面有多个 `input[type="file"]`，其中还有 pdf/doc 上传口。图片口是 `accept` 为 `.jpg,.jpeg,.png,.webp` 且 `multiple=true` 的那个，通常是第一个
- 传完页面显示 `图片编辑 N/18`，N 应等于实际张数
- 段落之间留一个空行即可；正文里的标签（#话题）直接写在末尾

### 段 ③ · 开定时开关 → 设时间 → 提交 → 验收

```js
const task = await taskSpace(7);           // 同一个 spaceId
const page = task.page("p1");

// 3.1 打开定时发布开关（开关藏在页面下方「更多设置」区块内，默认关闭）
//     ⚠️ 点整行容器无效，必须点开关本体 .d-switch
const r = await page.evaluate(() => {
  const w = [...document.querySelectorAll(".custom-switch-wrapper")]
    .find((el) => (el.innerText || "").includes("定时发布"));
  const s = w.querySelector(".d-switch");
  const b = s.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
});
await page.mouse.click(Math.round(r.x), Math.round(r.y), { label: "开启定时发布" });
await page.waitForTimeout(3000);

// 3.2 设置日期时间（直接键入比点日历面板快得多）
const t = await page.evaluate(() => {
  const inp = [...document.querySelectorAll("input")]
    .find((i) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(i.value || ""));
  const b = inp.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
});
await page.mouse.click(Math.round(t.x), Math.round(t.y), { label: "聚焦定时时间" });
await page.waitForTimeout(1000);
await page.keyboard.press("ControlOrMeta+a");   // 全选不能省，否则新值会拼在原值后面
await page.waitForTimeout(300);
await page.keyboard.type("2026-09-30 12:00");   // 24 小时制，格式必须是 YYYY-MM-DD HH:MM
await page.waitForTimeout(1000);
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
console.log((await page.evaluate(() =>
  ([...document.querySelectorAll("input")]
    .find((i) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(i.value || ""))?.value) ?? "未读到时间值")));

// 3.3 提交（⚠️ 页脚按钮不是 <button> 标签，querySelectorAll('button') 抓不到）
//     坐标随窗口尺寸而变，不要照抄：先 page.screenshot() 存图，量出按钮中心坐标再点
await page.mouse.click(771, 772, { label: "点击定时发布" });
await page.waitForTimeout(9000);
console.log(await page.url());
```

**开关定位口诀**：`.custom-switch-wrapper` 在这个区块里有三个，序号 0 是「原创声明」、1 是「允许正文复制」、2 是「定时发布」。**用文字匹配比用序号稳**，序号会随平台改版变动。

开启成功的判据有两条，缺一不可：
1. 底部按钮文字从「发布」变成「定时发布」
2. 出现一个值为 `YYYY-MM-DD HH:MM` 的日期时间输入框，默认值是当前时间

回车提交时间后，点一下页面空白处关闭面板，再复查一次输入框的值。

## 5. 五个已验证的坑

| # | 现象 | 原因 | 解法 |
|---|---|---|---|
| 1 | 脚本报错退出，提示有人工控制 | 浏览器弹出定位等权限授权窗 | 这类弹窗只能由用户亲自处理。停下让用户点掉（发笔记不需要定位，建议拒绝），再用 `takeOverTaskSpace(spaceId)` 接回**同一**空间，不要重开 |
| 2 | 点了「定时发布」但开关纹丝不动 | 点到了整行容器，开关本体在更内层 | 取 `.d-switch` 的 `getBoundingClientRect()` 中心坐标点 |
| 3 | 找不到日期时间输入框 | 定时开关还没打开 | 先执行 3.1，日期框才会被渲染出来 |
| 4 | `querySelectorAll('button')` 里没有「定时发布」 | 页脚按钮并非 button 标签 | 用坐标点，或先截图定位 |
| 5 | 正文看起来每段隔了四五行 | `innerText` 把每个空段落各算一个换行，纯属表示假象 | 查真实结构。`div[contenteditable]` 的子节点数等于段落数加空行数，一段配一个空行才是正常，不要重填 |

**坑一补充**：权限弹窗出现后，ego 会把任务空间交给用户，此时脚本会直接退出（退出码 1）。恢复方式是用 `takeOverTaskSpace(spaceId)` 接回同一空间，**不要新建空间重来**（新建会丢掉已传的图）。

## 6. 验收标准（四条，全过才算成功）

1. URL 出现 `published=true`
2. 发布表单被重置，草稿箱计数回到 0
3. 笔记管理列表首条就是刚发的笔记，状态显示「审核中」，定时时间显示正确
4. 笔记总数 +1

**只看提交成功的提示不算成功**，必须回笔记管理看到那条记录。四条里任何一条对不上，如实告诉用户卡在哪一条，不要含糊说「应该发出去了」。

## 7. 收尾

- 若工作空间里有发布台账 / 选题池（如 `发布台账.md`、`选题池.md`），把状态与时间回填进去；没有就跳过，并在汇报里提醒用户「建议留个发布记录」
- ⚠️ **定时发布需要审核通过才会按时发出。** 若审核未通过，到点不会发，且平台不会主动提醒。**提醒用户次日主动复查一次**（可用 `xhs-note-analytics` / `xhs-account-audit` 接上后续复盘）
- 关闭任务空间，释放浏览器

```js
const task = await taskSpace(7);
await task.finish({ keep: [] });
```

- 向用户汇报：发布账号、标题、图片张数、定时时间、spaceId、验收四条的结果

## 8. 其他已确认的事实（备查）

- 上传入口除了 `setInputFiles`，页面上还有一个「上传图片」按钮会拉起系统文件选择器。自动化场景走它更麻烦，优先用 `setInputFiles`
- 输入长度上限：标题 20 字，正文 1000 字
- 「允许正文复制」默认开启，关掉可以少被搬运
- 「公开可见」是下拉选项，可改为仅自己可见
- 发布页 URL 形如 `.../publish/publish?from=homepage&target=image&source=official`
- 本流程在 2026-09-29 的创作者平台新版界面（`/new/` 路径体系）下实测，平台改版后选择器可能失效，必要时重新探测

## 9. 未验证的事项（不做断言）

- 定时时间可设的最远天数上限（平台通常有窗口限制，实测只验证过次日）
- 不同账号类型下「定时发布」开关是否一律可见
- 审核通常耗时多久
- 定时发布能否在发出前取消或改期

## 10. 纪律

- **只在用户明确要求时发布**，一次一篇；用户没要求就不发起，也不主动问「要不要我帮你发」
- **发布前必须核对账号身份**，并把「账号 / 标题 / 张数 / 定时时间」交用户确认后才提交
- **不批量发布**、不刷互动、不改动用户笔记的既有内容；发布失败就如实报告卡在哪一步，不反复重试提交
- 图片、标题、正文一律以用户定稿的产物为准，**不临场改写内容**
