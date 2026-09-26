/**
 * 小红书场景内置 skill 汇总（?raw 打包，canvas guidelines / gzh skills 同款模式）。
 * name 带场景前缀防与用户目录 skill 撞名；description 是 <available_skills>
 * 目录里模型看到的唯一信息，须写清触发词。内容改编自外部 skill 包 xhs-Skills，
 * 已按本项目工具面改写：图文产物走画布画板（canvas_*，一页一个画布文档）、
 * 文案走文章工作台（article_*，type 用「小红书」）、生图走 image_generate、
 * 取数走 xhs_hot_notes（红狐）；源包的 Python/Node 脚本与宿主工具调用一律不搬。
 */
import type { BuiltInSkill } from '../types'
import router from './skills/xhs-router.md?raw'
import positioning from './skills/xhs-positioning.md?raw'
import hotspot from './skills/xhs-hotspot.md?raw'
import title from './skills/xhs-title.md?raw'
import writer from './skills/xhs-writer.md?raw'
import cover from './skills/xhs-cover.md?raw'
import cards from './skills/xhs-cards.md?raw'
import image from './skills/xhs-image.md?raw'
import accountAudit from './skills/xhs-account-audit.md?raw'
import noteAnalytics from './skills/xhs-note-analytics.md?raw'

export const XHS_SKILLS: ReadonlyArray<BuiltInSkill> = [
  {
    name: 'xhs-router',
    description:
      '小红书创作总控：判断用户卡在哪一环并路由到专项 skill、把多环节需求串成工作流。说「做小红书」「帮我运营小红书」「全流程」「不知道从哪下手」或一次提跨多个环节的需求时加载',
    content: router
  },
  {
    name: 'xhs-positioning',
    description:
      '小红书起号定位：赛道选择、定位句、人设三件套（账号名 / 简介 / 视觉）、内容支柱与前 20 篇选题、冷启动路径。说「想做小红书但不知道做什么」「帮我定位」「起号」「我适合做什么赛道」「重新定位」时加载',
    content: positioning
  },
  {
    name: 'xhs-hotspot',
    description:
      '小红书热点选题：按关键词 / 赛道拉近期高互动笔记，出热点表、趋势判断与可直接开写的选题卡（含 24 赛道词库与爆款共性提取）。说「小红书热点」「最近火什么」「查爆款」「小红书选题」「这个词热不热」时加载，配合 xhs_hot_notes 工具',
    content: hotspot
  },
  {
    name: 'xhs-title',
    description:
      '小红书爆款标题：15 种方法批量出候选 + 百分制评分 + 合规校验 + A/B 建议。说「起个小红书标题」「标题优化」「标题没人点」「怎么让人搜到我」时加载',
    content: title
  },
  {
    name: 'xhs-writer',
    description:
      '小红书笔记正文：7 种笔记类型骨架、开头 3 行折叠线、标签三层结构、高危词替换表、发布前 14 项体检。说「写小红书」「笔记正文」「种草文」「避雷帖」「改成小红书风格」「笔记体检」时加载',
    content: writer
  },
  {
    name: 'xhs-cover',
    description:
      '小红书封面：画板排版或生图直出两条路线，12 种原创风格、构图与安全区、标题拆行规则、逐字检查与定向修正。说「做封面」「配首图」「参考这张图做封面」「把人物放进封面」「做几版封面」时加载',
    content: cover
  },
  {
    name: 'xhs-cards',
    description:
      '小红书图文卡片（画布版）：把内容排成 6 张以上 3:4 画布页（一页一个画布文档），含页数档位 / 页序 / 页面组件 / 字号安全区 / 质量闸门。说「做小红书图文」「把内容排成卡片」「做 3:4 知识卡片」「教程图文」「把文章做成组图」时加载',
    content: cards
  },
  {
    name: 'xhs-image',
    description:
      '小红书信息图（生图型）：固定「轻盈 AI 产品信息图」视觉系统，用 image_generate 直出单图或 6-9 张组图（视觉风格锁定 + 文字密度控制 + 逐图复核）。说「做科技感信息图」「按内容生成组图」「做类似这种图」「做封面和内页图」时加载',
    content: image
  },
  {
    name: 'xhs-account-audit',
    description:
      '小红书账号体检：八维评分、竞品对标、卡点定位与不可迁移项清单。说「账号诊断」「帮我看看我的号」「我的号没起色 / 不涨粉」「主页体检」「对标账号拆解」时加载',
    content: accountAudit
  },
  {
    name: 'xhs-note-analytics',
    description:
      '小红书笔记数据复盘：14 项指标口径、六层漏斗归因、多篇横向找规律。说「笔记数据复盘」「这条为什么没流量」「曝光高但没人点」「哪类内容该加码」时加载（数据来自用户导出的表格或后台截图）',
    content: noteAnalytics
  }
]
