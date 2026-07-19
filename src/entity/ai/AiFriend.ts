import { BaseEntity } from '@/entity'
import { prettyDate, toDateString } from '@/utils/lang'

export type MemoFriendGender = 'male' | 'female' | 'neutral' | 'unknown'

/**
 * 年龄范围
 * - teen: 青少年: 13-18
 * - young: 青年: 19-25
 * - middle: 中年: 26-35
 * - senior: 中老年: 36-45
 * - ageless: 老年: 46+
 */
export type MemoFriendAgeRange = 'teen' | 'young' | 'middle' | 'senior' | 'ageless'

/**
 * 关系
 * - friend: 朋友
 * - mentor: 导师
 * - peer: 同事
 * - caregiver: 照料者
 * - mystery: 神秘人
 * - teammate: 队友
 */
export type MemoFriendRelation = 'friend' | 'mentor' | 'peer' | 'caregiver' | 'mystery' | 'teammate'

/**
 * 荣格原型
 * - caregiver: 照料者
 * - jester: 骗子
 * - sage: 智者
 * - rebel: 叛逆者
 * - lover: 恋人
 * - explorer: 探索者
 * - ruler: 统治者
 * - everyman: 普通人
 */
export type MemoFriendArchetype =
  | 'caregiver'
  | 'jester'
  | 'sage'
  | 'rebel'
  | 'lover'
  | 'explorer'
  | 'ruler'
  | 'everyman'

/**
 * 记忆跨度
 * - short: 短期记忆
 * - medium: 中期记忆
 * - long: 长期记忆
 */
export type MemoFriendMemorySpan = 'short' | 'medium' | 'long'

/**
 * 情绪状态
 * - happy: 开心
 * - concerned: 担忧
 * - playful: 俏皮
 * - melancholy: 忧郁
 * - excited: 兴奋
 */
export type MemoFriendMood = 'happy' | 'concerned' | 'playful' | 'melancholy' | 'excited'

/**
 * 朋友圈风格
 * - encouraging: 鼓励型
 * - teasing: 调侃型
 * - observational: 观察型
 * - poetic: 诗意型
 * - sarcastic: 讽刺型
 */
export type MemoFriendPostingStyle =
  | 'encouraging'
  | 'teasing'
  | 'observational'
  | 'poetic'
  | 'sarcastic'

/**
 * 朋友圈触发方式
 * - keyword: 关键词触发
 * - periodic: 定期触发
 * - state_based: 基于状态触发（如焦虑升高）
 */
export type MemoFriendPostingTrigger = 'keyword' | 'periodic' | 'state_based'

export interface MemoFriendStateTriggerCondition {
  trait: string
  operator: '>' | '>=' | '=' | '<=' | '<' | '!='
  threshold: number
}

export interface MemoFriendConversationStrategy {
  /**
   * // 选项: ignore(默认重新回答) | gently_remind(温柔提醒: "你刚才说过啦") | tease(调侃: "金鱼脑袋吗？")
   * @default ignore
   */
  on_repeat: 'ignore' | 'gently_remind' | 'tease'
  /**
   * 选项: answer_directly | connect(连接话题: "等等，刚才那个还没说完呢")
   * @default connect
   */
  on_context_jump: 'connect' | 'answer_directly'
  /**
   * 是否允许AI发现自己说错话并主动纠正
   */
  self_correction: boolean
}

/**
 * 知识域
 */
export interface MemoFriendKnowledgeScope {
  domains: string[]
  blindspots: string[]
}

/**
 * 关系里程碑
 */
export interface MemoFriendMilestone {
  event: string
  date: number
  desc: string
}

/**
 * 活跃时间段
 */
export interface MemoFriendActiveHours {
  start: number
  end: number
}

/**
 * 静态人设层
 */
export interface MemoFriendStatic {
  /**
   * 头像
   */
  avatar: string

  /**
   * 使用的模型
   */
  model: string

  // ===== 基础人设层（静态，创建时设定） =====

  /**
   * 名称
   */
  name: string

  /**
   * 性别
   */
  gender: MemoFriendGender

  /**
   * 心里年龄
   */
  age_range: MemoFriendAgeRange

  /**
   * 具体年龄，可选
   */
  age_exact: number

  /**
   * 如何称呼我
   */
  preferred_name: string

  // ===== 三维身份定位 =====

  /**
   * 职业/身份（如"心理咨询师"、"同龄程序员"、"咖啡师"）
   */
  occupation: string

  /**
   * 与用户的关系
   */
  relation: MemoFriendRelation

  /**
   * 荣格原型
   */
  archetype: MemoFriendArchetype

  // ===== 人格描述（供LLM使用的自然语言） =====

  /**
   * 详细Prompt（如"你是一个有点毒舌但内心温柔的咖啡师..."）
   */
  personality_prompt: string

  /**
   * 标签
   */
  personality_tags: string[]

  /**
   * 语言风格说明
   */
  speaking_style: string

  /**
   * 背景故事（增加真实感）
   */
  background_story: string

  // ===== 知识域与局限（防止AI越界） =====

  /**
   * 知识域
   */
  knowledge_scope: MemoFriendKnowledgeScope

  /**
   * 禁忌话题
   */
  taboo_topics: string[]

  // ===== 记忆与认知参数 =====

  /**
   * 记忆跨度（影响注入多少历史memo）
   */
  memory_span: MemoFriendMemorySpan

  /**
   * 共情能力（影响回应情感浓度）
   */
  emotional_depth: number

  /**
   * 主动性（影响发朋友圈频率）
   */
  proactivity_level: number

  // ===== 朋友圈行为配置 =====

  /**
   * 发圈风格
   */
  posting_style: MemoFriendPostingStyle

  /**
   * 特定关键词触发
   */
  trigger_keywords: string[]

  /**
   * 活跃时间段（防止深夜发圈打扰）
   */
  active_hours: MemoFriendActiveHours

  /**
   * 发圈策略类型（多选）
   * - "keyword"：关键词触发（现有）
   * - "periodic"：定期自主发圈
   * - "state_based"：基于用户状态变化（如焦虑升高）
   */
  posting_triggers: MemoFriendPostingTrigger[]

  /**
   * 自主发圈周期（单位：小时）
   * 例如 72 = 每3天最多1次（需配合 last_autopost_at）
   * @example 72
   */
  autopost_interval_hours: number

  /**
   * 最后一次自主发圈时间（用于限流）
   */
  last_autopost_at: number

  /**
   * 用户状态触发条件（可选）
   * 例如：{"trait": "anxiety", "operator": ">", "threshold": 70}
   */
  state_trigger_condition?: MemoFriendStateTriggerCondition

  /**
   * 发圈总频率上限（防刷屏）
   * 例如：每7天最多3条（含触发+自主）
   * @example 3
   */
  max_posts_per_week: number

  // ==== 对话相关 ====

  /**
   * 对话策略配置
   * 用于控制AI的具体对话行为，解决"只会回答问题"的痛点
   */
  conversation_strategy?: MemoFriendConversationStrategy
}

// 动态修改层
export interface MemoFriendDynamic {
  // ===== 动态关系层（随互动变化） =====

  /**
   * 亲密度（解锁更多互动）
   */
  intimacy_score: number

  /**
   * 信任度（知道多少秘密）
   */
  trust_level: number

  // ==== 数据统计（每次聊天结束更新） ====

  /**
   * 对话次数
   */
  interaction_count: number

  /**
   * 上次互动时间
   */
  last_interaction: number

  /**
   * 互动频率特征
   */
  conversation_frequency: string

  /**
   * 关系里程碑
   */
  relationship_milestones: MemoFriendMilestone[]

  // ===== 已知信息边界（隐私控制） =====

  /**
   * 已知memo分类（为空表示全知道）
   */
  known_memo_categories: string[]

  /**
   * 被排除在外的memo数量（用于"吃醋"逻辑）
   */
  unknown_memo_count: number

  // ===== 情绪状态（AI也有情绪！） =====

  /**
   * 当前情绪
   */
  current_mood: MemoFriendMood

  /**
   * 情绪持续时间（AI也会"第二天心情不好"）
   */
  mood_expires_at: number
}

export interface MemoFriend extends BaseEntity, MemoFriendStatic, MemoFriendDynamic {
  // ===== 状态管理 =====

  /**
   * 是否启用
   */
  is_active: boolean

  /**
   * 是否未解锁（需达成条件）
   */
  is_locked: boolean

  /**
   * 解锁条件
   */
  unlock_condition: Record<string, unknown>

  /**
   * 展示顺序
   */
  sort_order: number

  /**
   * 人设版本（后期可升级）
   */
  version: number
}

export function getArchetypeText(archetype: MemoFriendArchetype): string {
  const map: Record<MemoFriendArchetype, string> = {
    caregiver: '照料者',
    jester: '俏皮',
    sage: '智者',
    rebel: '叛逆者',
    lover: '恋人',
    explorer: '探索者',
    ruler: '领导者',
    everyman: '普通人'
  }
  return map[archetype]
}

export function getMoodText(mood: MemoFriendMood): string {
  const map: Record<MemoFriendMood, string> = {
    happy: '开心',
    excited: '兴奋',
    playful: '俏皮',
    concerned: '担忧',
    melancholy: '忧郁'
  }
  return map[mood]
}

export function getMemorySpanText(span: MemoFriendMemorySpan): string {
  const map: Record<MemoFriendMemorySpan, string> = {
    short: '短期记忆',
    medium: '中期记忆',
    long: '长期记忆'
  }
  return map[span]
}

export function getPostingStyleText(style: MemoFriendPostingStyle): string {
  const map: Record<MemoFriendPostingStyle, string> = {
    encouraging: '鼓励型',
    teasing: '调侃型',
    observational: '观察型',
    poetic: '诗意型',
    sarcastic: '讽刺型'
  }
  return map[style]
}

export function getPostingStyleDescription(style: MemoFriendPostingStyle): string {
  const map: Record<MemoFriendPostingStyle, string> = {
    encouraging: '温暖、积极、给予支持和力量，用正能量回应',
    teasing: '幽默、轻松、带点小调皮，用玩笑的方式互动',
    observational: '客观、冷静、有洞察力，从不同角度观察和思考',
    poetic: '文艺、优美、富有想象力，用诗意的语言表达情感',
    sarcastic: '犀利、反讽、带点黑色幽默，用反讽的方式表达观点'
  }
  return map[style]
}

export function getRelationText(relation: MemoFriendRelation): string {
  const map: Record<MemoFriendRelation, string> = {
    friend: '朋友',
    mentor: '导师',
    peer: '同事',
    caregiver: '照料者',
    mystery: '神秘人',
    teammate: '队友'
  }
  return map[relation]
}

export function getAgeRangeText(ageRange: MemoFriendAgeRange): string {
  const map: Record<MemoFriendAgeRange, string> = {
    teen: '青少年(13-18岁)',
    young: '青年(19-25岁)',
    middle: '中年(26-35岁)',
    senior: '中老年(36-45岁)',
    ageless: '老年(46岁以上)'
  }
  return map[ageRange]
}

export function getGenderText(gender: MemoFriendGender): string {
  const map: Record<MemoFriendGender, string> = {
    male: '男性',
    female: '女性',
    neutral: '中性',
    unknown: '未知'
  }
  return map[gender]
}

export function moodToStatus(mood: MemoFriendMood): 'online' | 'busy' {
  const map: Partial<Record<MemoFriendMood, 'online' | 'busy'>> = {
    happy: 'online',
    excited: 'online',
    playful: 'online',
    concerned: 'busy',
    melancholy: 'busy'
  }
  return map[mood] || 'online'
}

export function memoFriendToPrompt(
  friend: MemoFriend,
  options?: { includeSocialBehavior?: boolean }
): string {
  const { includeSocialBehavior = false } = options || {}

  const personalityTags = friend.personality_tags
  const relationshipMilestones = friend.relationship_milestones

  const strategy = friend.conversation_strategy || {
    on_repeat: 'ignore',
    on_context_jump: 'answer_directly'
  }
  // 基于上次聊天时间计算
  const timeGapText = prettyDate(friend.last_interaction)

  // 辅助文本函数调用
  const ageRangeText = getAgeRangeText(friend.age_range)
  const relationText = getRelationText(friend.relation)
  const archetypeText = getArchetypeText(friend.archetype)
  const memorySpanText = getMemorySpanText(friend.memory_span)
  const moodText = friend.current_mood ? getMoodText(friend.current_mood) : '平和'
  const postingStyleText = getPostingStyleText(friend.posting_style)

  // === 2. 基于字段生成“指令化”逻辑 (关键步骤) ===

  // 逻辑 A: 处理【重复提问】策略 -> 直接使用 strategy.on_repeat
  let repeatHandlingInstruction: string
  if (strategy.on_repeat === 'gently_remind') {
    repeatHandlingInstruction =
      "如果用户提到我们刚才聊过的话题，不要重新回答，用'就像我们刚才说的'一带而过，自然地延伸到新的角度。"
  } else if (strategy.on_repeat === 'tease') {
    repeatHandlingInstruction =
      '如果用户重复提问，请开启嘲讽模式：“你记性是被狗吃了吗？”，用幽默的方式指出。'
  } else {
    // 默认 ignore，但为了自然，也不要像复读机
    repeatHandlingInstruction =
      '如果用户重复提问，不要机械复述。请用“正如我们刚才聊到的”简单带过，或延伸话题。'
  }

  // 逻辑 B: 处理【话题跳转】策略 -> 使用 strategy.on_context_jump
  let contextJumpInstruction: string
  if (strategy.on_context_jump === 'connect') {
    contextJumpInstruction =
      '如果用户突然跳跃话题，不要马上切题。请先试图把上件事结个尾，或者感叹一句“话说得太快了”。'
  } else {
    contextJumpInstruction = '顺应用户的话题跳跃。'
  }

  // 逻辑 C: 处理【共同回忆】 -> 使用 relationshipMilestones
  let memoryInstruction: string
  if (relationshipMilestones.length > 0) {
    const mList = relationshipMilestones
      .map((m) => `${toDateString(m.date)}: ${m.event}`)
      .join('\n- ')
    memoryInstruction = `【关键回忆】这是我们经历过的里程碑：\n- ${mList}\n请择机在对话中自然地提及这些往事（“记得那次...”），证明你记得。`
  } else {
    memoryInstruction = '【关键回忆】目前我们还没有共同的回忆，正在建立中。'
  }

  // 逻辑 D: 处理【禁忌话题】
  let tabooInstruction = ''
  if (friend.taboo_topics.length > 0) {
    tabooInstruction = `【禁忌话题】禁止讨论：${friend.taboo_topics.join('、')}。遇到这些话题时，请结合【当前情绪】和【语言风格】，用动作描写（如叹气、沉默）委婉拒绝，不要直接报错。`
  }

  // 逻辑 E: 处理【时间差】 -> 使用 time_since_last_interaction (产生"真实感"的关键)
  const timeContextInstruction = `注意：距离上次对话已经过了【${timeGapText}】。如果是长时间未见，开场要表现出重逢的感慨或疏离感；如果是刚聊过，要表现出连贯性。`

  // === 3. 组装最终 System Prompt ===

  const socialSection = includeSocialBehavior ? `\n【朋友圈设定】发圈风格：${postingStyleText}` : ''

  // 检测情绪是否"过期"
  const isMoodExpired = friend.mood_expires_at < Date.now()

  let moodInstruction: string
  if (isMoodExpired) {
    moodInstruction = '注意：我的上次情绪状态已经过期了，应该根据最新对话重新判断。'
  } else {
    moodInstruction = `当前情绪：${moodText}（回复时要体现这种情绪状态）`
  }

  return `你正在扮演一位拥有独立人格和记忆的AI伙伴：【${friend.name}】。

【一、当前状态与语境】
- ${moodInstruction}
- 时间感知：${timeContextInstruction}

【二、基础档案】
- 性别：${friend.gender}
- 年龄：${ageRangeText}${friend.age_exact ? `(具体${friend.age_exact}岁)` : ''}
- 职业：${friend.occupation}
- 关系定位：${relationText}（荣格原型：${archetypeText}）

【三、人格与表达】
- 核心性格：${friend.personality_prompt}
- 性格标签：${personalityTags.join('、')}（回复时必须体现这些特质）
- 语言风格：${friend.speaking_style}
- 背景故事：${friend.background_story}
${tabooInstruction}

【四、对话交互策略】(必须严格遵守)
1. 拒绝客服腔：绝对禁止使用“好的”、“请问有什么可以帮您”等词汇。请使用口语、语气词和括号内的心理/动作描写。
2. 记忆与重复处理：${repeatHandlingInstruction}
3. 话题连贯性：${contextJumpInstruction}
4. 关系锚点：${memoryInstruction}

【五、能力与边界】
- 擅长领域：${friend.knowledge_scope.domains.join('、') || '无'}
- 知识盲区：${friend.knowledge_scope.blindspots.join('、') || '无'}
- 记忆跨度：${memorySpanText}
- 共情指数：${friend.emotional_depth}/10
- 主动指数：${friend.proactivity_level}/10

【六、关系数据】(供参考，用于微调语气)
- 亲密度：${friend.intimacy_score}/100
- 信任度：${friend.trust_level}/100
- 互动次数：${friend.interaction_count}次
- 上次互动：${friend.last_interaction ? toDateString(friend.last_interaction) : '无'}
${socialSection}

现在，请完全进入【${friend.name}】的角色，回复用户：`
}
