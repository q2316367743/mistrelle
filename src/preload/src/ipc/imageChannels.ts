/**
 * 文生图领域通道常量与载荷类型（preload 桥与 main handler 共用）。
 *
 * 设计约定：
 * - 生图任务的编排与运行态（提交 / 轮询 / 落盘 / 收尾）全在 main 的 ImageService，
 *   渲染层只发指令（generate / resume / remove / list）并经 recordChanged 广播感知进展，
 *   因此任务状态跨窗口、跨页面刷新存活，未来新增生图页面直接复用同一服务。
 * - 记录行与列表查询类型沿用 dbChannels（image_generate 表形状单一来源）。
 * - 提交 / 轮询的 HTTP 细节在 main RelayService（/v1/images/*，注入 Bearer），凭证不下发。
 */
import type { ImageRecordInput } from './dbChannels'

export const ImageChannels = {
  /** 生图模型列表（服务端档位 code；未登录抛错） */
  getModels: 'image:getModels',
  /** 发起生成（默认立即返回 pending 记录；工具直出 / wait 模式返回终态） */
  generate: 'image:generate',
  /** 续轮询一个可恢复的失败记录（同一远端任务，不重新提交、不重复扣费） */
  resume: 'image:resume',
  /** 删除记录（联动取消 pending 任务与删除落盘文件） */
  remove: 'image:remove',
  /** 分页查询生成记录（筛选 / 排序 / 分页在 SQL 内完成） */
  list: 'image:list',
  /** main → 渲染：记录生命周期变更广播（pending → success / failed 推进） */
  recordChanged: 'image:recordChanged'
} as const

/** 轮询失败分类：terminal=远端已确认终态（只可删除）；resumable=任务可能仍在跑（可续轮询） */
export type ImagePollFailureKind = 'terminal' | 'resumable'

/** 生图模型档位选项（服务端 /v1/images/models 直出 label/value，t-select options 可直接绑定） */
export interface ImageModelOption {
  label: string
  value: string
}

/** 生图失败结果（记录落库 / 工具透传共用） */
export interface ImageGenerateError {
  error: string
  kind: ImagePollFailureKind
  /** 异步任务型失败时存在：远端 task_id 与查询窗口截止时间（续轮询依据） */
  taskId?: string
  pollMaxAt?: number
}

/** 生图成功结果 */
export interface ImageGenerateSuccess {
  path: string
  width?: number
  height?: number
}

/** 单次生成的终态结果（成功 / 失败判别联合） */
export type ImageTaskOutcome = ImageGenerateSuccess | ImageGenerateError

/** 生成入参 */
export interface ImageGenerateParams {
  prompt: string
  /** 服务端生图档位 code；缺省由调用方先回退默认生图模型，本侧为空直接报错 */
  model?: string
  /** 输出尺寸（宽x高，如 1024x1024）；缺省 1024x1024 */
  size?: string
  /** 设计风格名快照（仅建记录模式落库展示；风格提示词已由渲染层拼进 prompt） */
  styleName?: string | null
  /**
   * 是否建记录（默认 true）：建 image_generate 记录并广播生命周期，立即返回 pending 记录；
   * 工具直出模式（false）不建记录不广播，产物落盘 path 并等待终态返回
   */
  record?: boolean
  /** record=false 时必填：输出图片文件绝对路径 */
  path?: string
  /** 等待终态再返回（默认 false）；record=false 恒为等待终态 */
  wait?: boolean
}

/** generate 返回：started=已建记录（后台生成，进展经 recordChanged 广播）；finished=终态 */
export type ImageGenerateInvokeResult =
  | { phase: 'started'; record: ImageRecordInput }
  | { phase: 'finished'; result: ImageTaskOutcome }
