/**
 * window.preload.image 契约：文生图域桥。
 * 任务编排与运行态在 main（ImageService 单例）：渲染层发指令（generate/resume/remove/list）、
 * 经 onRecordChanged 广播感知生成进展；表形状类型（ImageRecordInput 等）沿用 db.d.ts。
 */

/** 轮询失败分类：terminal=远端已确认终态（只可删除）；resumable=任务可能仍在跑（可续轮询） */
declare type ImagePollFailureKind = 'terminal' | 'resumable'

/** 生图失败结果（记录落库 / 工具透传共用） */
declare interface ImageGenerateError {
  error: string
  kind: ImagePollFailureKind
  /** 异步任务型失败时存在：远端 task_id 与查询窗口截止时间（续轮询依据） */
  taskId?: string
  pollMaxAt?: number
}

/** 生图成功结果（path/width/height 为第一张；n>1 时 images 含全部产物） */
declare interface ImageGenerateSuccess {
  path: string
  width?: number
  height?: number
  images?: ImageItem[]
}

/** 单次生成的终态结果（成功 / 失败判别联合） */
declare type ImageTaskOutcome = ImageGenerateSuccess | ImageGenerateError

/** 生成入参（prompt 已含风格提示词；model 为服务端档位 code） */
declare interface ImageGenerateParams {
  prompt: string
  model?: string
  /** 输出尺寸（宽x高 或 比例，如 1024x1024 / 16:9）；缺省由服务端 / 上游决定 */
  size?: string
  /** 输出像素档位（1k / 2k / 4k），与 size 共同决定实际尺寸 */
  resolution?: string
  /** 单次生成张数（1-4 整数，main 侧 clamp）；缺省 1 */
  n?: number
  /** 质量档位（如 auto / high / medium / low），原样透传上游 */
  quality?: string
  /** 背景（auto / transparent / opaque） */
  background?: string
  /** 输出格式（png / jpeg / webp）；非 png 时落盘扩展名跟随 */
  outputFormat?: string
  /** 输出压缩率 0-100（jpeg / webp 有效） */
  outputCompression?: number
  /** 内容审核档位（auto / low） */
  moderation?: string
  /** 提交前 NSFW 审核（上游 moderation） */
  nsfwCheck?: boolean
  /** 参考图：本地绝对路径 / http URL / data URI（main 归一化后透传）；非空触发图生图，≤15 张 */
  imageUrls?: string[]
  styleName?: string | null
  /** 是否建记录（默认 true）；false = 工具直出：不建记录不广播，产物落盘 path 并返回终态 */
  record?: boolean
  /** record=false 时必填：输出图片文件绝对路径（n>1 时第 2 张起追加 -2/-3/-4 序号） */
  path?: string
  wait?: boolean
}

/** generate 返回：started=已建记录（进展经广播）；finished=终态（工具直出 / wait 模式） */
declare type ImageGenerateInvokeResult =
  { phase: 'started'; record: ImageRecordInput } | { phase: 'finished'; result: ImageTaskOutcome }

/** 生图模型档位选项（服务端档位；t-select options 可绑定；priced 含 pointsPerImage） */
declare interface ImageModelOption {
  label: string
  value: string
  /** 每张消耗积分（仅登录后 priced 列表有） */
  pointsPerImage?: number
}

declare interface ImageApi {
  /** 生图模型档位选项（未登录公开列表，已登录含积分） */
  getModels(): Promise<ImageModelOption[]>
  generate(params: ImageGenerateParams): Promise<ImageGenerateInvokeResult>
  /** 续轮询一个可恢复的失败记录（同一远端任务，后续状态经广播推进） */
  resume(id: string): Promise<void>
  remove(id: string): Promise<void>
  list(params: ImageListParams): Promise<ImageListResult>
  /** 订阅记录生命周期广播；返回取消订阅函数 */
  onRecordChanged(handler: (record: ImageRecordInput) => void): () => void
}
