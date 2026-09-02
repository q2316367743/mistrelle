/**
 * 在线设计风格远端 API（main）：经 AuthService.authedApiGet 拉 /api/user/design-styles。
 * 与 AuthService 解耦，避免继续膨胀单文件。
 */
import { authedApiGet } from './AuthService'
import type {
  AuthDataResult,
  AuthDesignStyleDetail,
  AuthDesignStyleItem
} from '~/ipc/authChannels'

/** 启用中的在线风格列表（卡片投影）；需登录且具备 extendedDesignStyles */
export function listDesignStyles(): Promise<AuthDataResult<AuthDesignStyleItem[]>> {
  return authedApiGet<AuthDesignStyleItem[]>('/api/user/design-styles/')
}

/** 在线风格完整详情（含提示词等 payload） */
export function getDesignStyle(id: string): Promise<AuthDataResult<AuthDesignStyleDetail>> {
  const safe = encodeURIComponent(id.trim())
  return authedApiGet<AuthDesignStyleDetail>(`/api/user/design-styles/${safe}`)
}
