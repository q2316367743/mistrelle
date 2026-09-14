/**
 * image_generate 相关提示词知识的单一源。
 *
 * 两类消费方：
 * 1. 设计创意双引擎（canvasPrompt / designHtmlPrompt）：生图增强规则，仅登录（image_generate 已注入）时追加；
 *    差异仅在「产物填到哪里」（画布 image 节点 imageUrl / HTML `<img src>`）与按需加载指南工具名。
 * 2. 生图型子 Agent（subagent/prompt）：只做文生图、不涉及画布 / HTML 节点，用自包含版本。
 *
 * 放在设计素材工具目录：image_generate 归属此模块，生图提示词知识跟随工具同居，避免散落多处失同步。
 */

/**
 * 设计引擎场景的生图增强规则（登录后追加）。
 * @param target 产物路径填到哪里（画布 image 节点 imageUrl / HTML `<img src>`）
 * @param guidelinesTool 按需加载省钱规范的指南工具名（canvas_guidelines / html_guidelines）
 */
export const buildSceneImageGenerateRules = (
  target: string,
  guidelinesTool: string
): string[] => [
  '### 主视觉来源策略（生图增强，已登录可用生图工具）',
  `- 无真实素材的插画 / 人物 / 场景 / 纹理 / 抽象视觉 → **用 image_generate(prompt, path?) 生成**（已登录，工具可用），把返回的本地 path 填进 ${target}；生成失败或服务不可用时才回退 stock / placeholder / 几何图形组合。`,
  `- 多个生图素材合并成一张 sprite 图一次生成、再用 image_crop 切分（省钱规范见 ${guidelinesTool}("image-generation")）；生图失败时如实告知用户，不反复重试。`,
  `- **生图产物带不透明背景色（多为白底，模型不支持真透明）**：需要透明底素材时，用 image_remove_background(path) 去除背景（从边缘清除连续白底，产出带 alpha 的 PNG）后，再把去背景后的 path 填进 ${target}；禁止把带白底的图直接盖在深色 / 彩色背景上。`
]

/**
 * 生图型子 Agent 的生图规则（自包含：不涉及画布 / HTML 节点，产物直接落盘返回路径）。
 * 与设计引擎场景规则同源，去掉节点填充与画布 / HTML 专属表述。
 */
export const IMAGE_SUB_AGENT_RULES = [
  '### 生图规则',
  '- 无真实素材的插画 / 人物 / 场景 / 纹理 / 抽象视觉直接用 image_generate 生成；有真实来源（真实 logo / 品牌图 / 用户提供的图片）时禁止生图，改用真实素材或如实说明',
  '- 一张图一次生成：内容互不相关的图（如封面 + 各小节插图）每张单独调用一次 image_generate，不要拼成一张再切分',
  '- 需要多个**同类小素材**（一组图标 / 徽标 / 装饰元素）时改走省钱规范：拼成一张统一网格的 sprite 图**一次生成**，再用 image_crop 按网格切分——1 次生图成本换 N 个素材',
  '- **生图不支持真透明**：产物必带不透明背景色（多为白底），prompt 里写 transparent 也出不了真透明；规划画面时直接按「带底色的完整画面」设计，不要依赖透明底',
  '- 生成失败或服务不可用时如实说明原因，不反复重试；模型档位可选时，封面等画质要求高的图用较高档位，普通插图用默认档位以省积分'
]
