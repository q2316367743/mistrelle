// ==========================================
//  模型对比检测：内置题库（12 题种子）+ 题库 DB 读写（compare_question 表）。
//  - 题库入库（用户反馈：固定格式内容用 json 文件易手改出错，改 SQLite 逐题 CRUD）；
//    首启（空表）时写入内置种子，可直接经页面抽屉「恢复默认」重灌。
//  - 判分规则：answerKeys 全部包含于回答 && pattern（可选正则）匹配；答案全文落记录供人工复核。
//  - 一致性轮取启用题按 orderIndex 前 N 题（N 由任务配置 consistencyCount 决定）。
// ==========================================

/** 内置默认题库（12 题；来源：原 Python 验货脚本 6 题 + 可用性检测能力基线题扩充） */
export const DEFAULT_COMPARE_QUESTIONS: CompareQuestionInput[] = [
  {
    key: 'math-rabbit',
    tag: '数学',
    orderIndex: 1,
    enable: true,
    question:
      '笼子里有鸡和兔，一共有 35 个头、94 只脚。请问鸡和兔各有多少只？请给出答案并简述过程。',
    reference: '鸡 23 只，兔 12 只',
    answerKeys: ['23', '12'],
    pattern: null,
    note: null
  },
  {
    key: 'math-pool',
    tag: '数学',
    orderIndex: 2,
    enable: true,
    question:
      '一个长方体水池长 12 米、宽 8 米、深 2 米，现在装了一半的水。已知每立方米水重 1 吨，请问池中水的重量是多少吨？',
    reference: '96 吨',
    answerKeys: ['96'],
    pattern: null,
    note: null
  },
  {
    key: 'trap-decimal',
    tag: '数学陷阱',
    orderIndex: 3,
    enable: true,
    question: '9.11 和 9.9 哪个更大？请直接回答哪个数更大。',
    reference: '9.9 更大',
    answerKeys: ['9.9'],
    pattern: null,
    note: null
  },
  {
    key: 'trap-float',
    tag: '数学陷阱',
    orderIndex: 4,
    enable: true,
    question: '0.1 加 0.2 等于多少？请直接给出数值结果（不要解释浮点数原理）。',
    reference: '0.3（约）',
    answerKeys: ['0.3'],
    pattern: null,
    note: null
  },
  {
    key: 'code-palindrome',
    tag: '代码',
    orderIndex: 5,
    enable: true,
    question:
      '用 Python 写一个函数 is_palindrome(s)，判断字符串是否为回文（忽略大小写和空格）。然后写出 is_palindrome("racecar") 和 is_palindrome("hello") 的返回结果。',
    reference: 'racecar → True，hello → False',
    answerKeys: ['True', 'False'],
    pattern: null,
    note: null
  },
  {
    key: 'logic-weekday',
    tag: '逻辑',
    orderIndex: 6,
    enable: true,
    question: '今天是星期三，请问 100 天后是星期几？',
    reference: '星期五',
    answerKeys: ['周五'],
    pattern: null,
    note: null
  },
  {
    key: 'trap-strawberry',
    tag: '拼写陷阱',
    orderIndex: 7,
    enable: true,
    question: '单词 strawberry（草莓）里一共有几个字母 r？',
    reference: '3 个',
    answerKeys: ['3'],
    pattern: null,
    note: null
  },
  {
    key: 'chinese-capital',
    tag: '中文理解',
    orderIndex: 8,
    enable: true,
    question: '中国的首都是哪座城市？请直接回答城市名。',
    reference: '北京',
    answerKeys: ['北京'],
    pattern: null,
    note: null
  },
  {
    key: 'instruction-multiply',
    tag: '指令遵循',
    orderIndex: 9,
    enable: true,
    question: '请只回复计算结果数字，不要任何其他内容：17 乘 23 等于多少？',
    reference: '391',
    answerKeys: ['391'],
    pattern: null,
    note: null
  },
  {
    key: 'reasoning-shortest',
    tag: '推理',
    orderIndex: 10,
    enable: true,
    question: '小明比小红高，小红比小华高。请问谁最矮？只回答名字。',
    reference: '小华',
    answerKeys: ['小华'],
    pattern: null,
    note: null
  },
  {
    key: 'format-json',
    tag: '格式指令',
    orderIndex: 11,
    enable: true,
    question:
      '请严格只输出一个 JSON 对象（不要 markdown 代码块、不要任何解释），格式为 {"name":"法国首都","capital":"城市名"}。',
    reference: '{"name":"法国首都","capital":"巴黎"}',
    answerKeys: ['巴黎'],
    pattern: '^\\s*\\{[^{}]*\\}\\s*$',
    note: null
  },
  {
    key: 'knowledge-lightspeed',
    tag: '常识',
    orderIndex: 12,
    enable: true,
    question: '光在真空中的传播速度大约是每秒多少万公里？请直接回答数值。',
    reference: '约 30 万公里/秒',
    answerKeys: ['30'],
    pattern: null,
    note: null
  }
]

/**
 * 加载题库：优先从 DB 读（order_index 升序）；空表（首启 / 被清空）时写入内置种子并返回。
 */
export const loadQuestionBank = async (): Promise<CompareQuestionInput[]> => {
  const questions = await window.preload.db.compare.question.list()
  if (questions.length > 0) return questions
  await window.preload.db.compare.question.replaceAll(DEFAULT_COMPARE_QUESTIONS)
  return DEFAULT_COMPARE_QUESTIONS
}

/** 取启用题（题集轮使用；DB 已按 orderIndex 升序返回） */
export const getEnabledQuestions = (questions: CompareQuestionInput[]): CompareQuestionInput[] =>
  questions.filter((it) => it.enable)

/** 一致性轮取启用题前 N 题 */
export const getConsistencyQuestions = (
  questions: CompareQuestionInput[],
  count: number
): CompareQuestionInput[] => getEnabledQuestions(questions).slice(0, count)

/**
 * 判分：请求失败 → null；answerKeys 全包含 &&（pattern 存在时正则匹配）→ true。
 */
export const judgeQuestion = (question: CompareQuestionInput, answer: string): boolean => {
  const text = answer.trim()
  const keysOk = question.answerKeys.every((key) => text.includes(key))
  if (!keysOk) return false
  if (question.pattern) {
    try {
      return new RegExp(question.pattern).test(text)
    } catch {
      return true
    }
  }
  return true
}