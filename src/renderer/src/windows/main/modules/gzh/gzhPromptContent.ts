/**
 * 公众号 aside 能力的提示词构建：正文质检（QcSection 消费）。
 * 检查项源自 gzh 写作 skill 的成稿清单与 AI 腔黑名单，输出严格 JSON 供 extractGzhJson 解析。
 */

/** 单项检查结果（key 与 QC_ITEMS 对应，label 由 AI 原样回显） */
export interface GzhQcItem {
  key: string
  label: string
  pass: boolean
  /** 未过原因或修改建议（通过时可省略） */
  note?: string
}

/** 质检结果契约（模型按此 JSON schema 输出） */
export interface GzhQcResult {
  /** pass=全部通过；fail=存在未过项 */
  verdict: 'pass' | 'fail'
  /** 全文字数（去空白） */
  words: number
  items: GzhQcItem[]
}

/** 质检项定义（id / 名称 / 判定标准，与 skill 成稿清单同源） */
const QC_ITEMS: ReadonlyArray<{ key: string; label: string; rule: string }> = [
  { key: 'opening', label: '开头独立', rule: '开头几句话能独立成摘要，不看标题也知道文章要讲什么' },
  {
    key: 'voice',
    label: '有我',
    rule: '文中有作者视角或亲历感（判断、经历、体感），不是干巴巴的资料搬运式说教'
  },
  {
    key: 'examples',
    label: '例子真实',
    rule: '例子具体可信（有时间 / 地点 / 数字 / 细节），没有编造痕迹'
  },
  {
    key: 'boundary',
    label: '边界清晰',
    rule: '不把推测写成事实，不替读者做绝对化结论，事实与观点分得清'
  },
  {
    key: 'paragraph',
    label: '段落节奏',
    rule: '单段不超过 90 字（手机约 4 行），长句有拆分，读起来不憋'
  },
  {
    key: 'ending',
    label: '结尾一个动作',
    rule: '结尾只给读者一个明确的动作（在看 / 留言 / 试一下等），不堆多个号召'
  },
  {
    key: 'ai_tone',
    label: '无 AI 腔',
    rule: '没有「本质上 / 说白了 / 换句话说 / 综上 / 在这个时代」等套话；「不是 X 而是 Y」全文最多 1 次；无三段排比堆砌；自问自答必须给出具体回答'
  }
]

/** 质检 system 提示词（要求严格 JSON 输出） */
const QC_SYSTEM = [
  '你是公众号文章质检员。按给定检查项逐项检查文章，只输出一个 JSON 对象，不要输出任何其他内容。',
  'JSON 格式：{"verdict":"pass|fail","words":数字,"items":[{"key":"检查项key","label":"检查项名称","pass":布尔,"note":"未过原因或修改建议（通过时省略）"}]}',
  `检查项（key 必须完全一致）：`,
  ...QC_ITEMS.map((item) => `- ${item.key}（${item.label}）：${item.rule}`),
  'words 为正文去空白字符后的字数。全部通过时 verdict 为 pass，否则为 fail。'
].join('\n')

/** 构建质检消息：输入文章标题与正文，system + 单条 user */
export const buildQcMessages = (input: {
  title: string
  content: string
}): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } => ({
  system: QC_SYSTEM,
  messages: [
    {
      role: 'user',
      content: `请质检下面这篇公众号文章。\n\n【标题】${input.title || '（无标题）'}\n【正文】\n${input.content}`
    }
  ]
})
