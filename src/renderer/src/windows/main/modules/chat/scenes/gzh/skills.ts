/**
 * 公众号场景内置 skill 汇总（?raw 打包，canvas guidelines 同款模式）。
 * name 带场景前缀防与用户目录 skill 撞名；description 是 <available_skills>
 * 目录里模型看到的唯一信息，须写清触发词。内容改编自 gzh-Skills（外部 skill 包），
 * 已按本项目工具面改写（design_draw / article_write / gzh_trends / 本地排版渲染器）。
 */
import type { BuiltInSkill } from '../types'
import write from './skills/gzh-write.md?raw'
import short from './skills/gzh-short.md?raw'
import positioning from './skills/gzh-positioning.md?raw'
import title from './skills/gzh-title.md?raw'
import trends from './skills/gzh-trends.md?raw'
import layout from './skills/gzh-layout.md?raw'
import cover from './skills/gzh-cover.md?raw'
import diagram from './skills/gzh-diagram.md?raw'

export const GZH_SKILLS: ReadonlyArray<BuiltInSkill> = [
  {
    name: 'gzh-write',
    description:
      '公众号长文写作方法论（1500–4000 字）全流程。写公众号长文 / 扩写 / 续写卡住 / 素材整合 / 破题 / 重写润色时加载；短文走 gzh-short',
    content: write
  },
  {
    name: 'gzh-short',
    description:
      '公众号短文写作（≤1000 字纯文字）：写个短的 / 一千字以内 / 随手写一条 / 压成短文 / 不配图那种时加载，风格规则 + 逐项检查清单',
    content: short
  },
  {
    name: 'gzh-positioning',
    description:
      '公众号定位三件套：账号简介 / 功能介绍 / 关注后回复 / 欢迎语 / 自动回复 / 菜单设计 / 菜单栏 / 公众号装修 / 新号起步 / 号没人关注时加载',
    content: positioning
  },
  {
    name: 'gzh-title',
    description:
      '公众号爆款标题生成：起标题 / 标题优化 / 10万+ 标题时加载，16 种方法 + 评分分级 + A/B 建议',
    content: title
  },
  {
    name: 'gzh-trends',
    description:
      '公众号爆款数据分析：赛道爆款 / 爆款文章数据 / 多赛道对比 / 找选题时加载，配合 gzh_trends 工具使用（含泛化词闸门与默认赛道组）',
    content: trends
  },
  {
    name: 'gzh-layout',
    description:
      '公众号排版：排成公众号格式 / 排版 / 样式美化时加载。排版由侧边栏本地渲染器完成，此 skill 约束内容结构与风格推荐',
    content: layout
  },
  {
    name: 'gzh-cover',
    description: '公众号封面：做封面 / 头图 / 分享用图时加载，2.35:1 双裁切安全区策略与提示词配方',
    content: cover
  },
  {
    name: 'gzh-diagram',
    description:
      '公众号配图：逻辑图 / 流程图 / 架构图 / 数据图表等结构化插图，SVG HTML 与 design_draw 双路线',
    content: diagram
  }
]
