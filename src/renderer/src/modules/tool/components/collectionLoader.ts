import type { Ref } from 'vue'
import type { ToolFunction } from '@/domain'
// 说明：与 @/modules/tool/index.ts 存在模块环依赖，但 toolGroups/toolCollectionMap 仅在函数运行时访问
// （模块均已加载完成），安全——同 components/agent/index.ts 先例（@see docs/tool/07 的叶子 import 约束）
import { toolCollectionMap, toolGroups } from '@/modules/tool'

export const TOOL_LOAD_TOOL_NAME = 'load_tool_collection'

/**
 * 渐进式工具加载的装载工具（闭包工厂）：绑定所在对话的已装载集合 id 列表。
 * 模型按 <available_tool_collections> 目录中的 id 整组装载可选工具组；
 * 装载状态由调用方（AgentChat）持有，仅本次消息任务有效，不落库不持久化。
 */
export const createToolLoadTool = (loadedIds: Ref<string[]>): ToolFunction => ({
  name: TOOL_LOAD_TOOL_NAME,
  label: '装载工具集',
  description:
    '按集合 id 装载一组可选工具（ids 可一次传多个）。除常驻基础工具外的可选能力以集合目录形式提供，' +
    '需要使用某组能力而对应工具不在你的可用列表中时，先调用本工具装载，之后即可调用该组的全部工具。',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        description: '要装载的工具集合 id 列表（取值见系统提示词 <available_tool_collections> 目录）',
        items: { type: 'string', description: '工具集合 id，如 date / browser / aihot' }
      }
    },
    required: ['ids']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { ids } = params[0] as { ids?: unknown }
    if (!Array.isArray(ids) || ids.length === 0) return { error: 'ids 必须是非空数组' }
    const requested = [...new Set(ids.filter((e): e is string => typeof e === 'string'))]
    if (requested.length === 0) return { error: 'ids 必须是字符串数组' }
    const invalid = requested.filter((id) => !toolCollectionMap[id])
    if (invalid.length > 0) {
      return {
        error: `以下集合 id 不存在：${invalid.join('、')}。可用集合：${toolGroups
          .map((g) => `${g.id}(${g.group})`)
          .join('、')}`
      }
    }
    // 去重追加；重复装载幂等（提示当前依然可用即可）
    const added = requested.filter((id) => !loadedIds.value.includes(id))
    loadedIds.value = [...loadedIds.value, ...added]
    return {
      loaded: requested,
      collections: requested.map((id) => {
        const group = toolCollectionMap[id]
        return {
          id,
          group: group.group,
          tools: group.tools.map((t) => ({
            name: t.name,
            label: t.label,
            description: t.description
          }))
        }
      }),
      message: added.length
        ? '工具集装载成功，上述工具在本条消息任务期间持续可用'
        : '这些集合此前已装载过，相关工具当前依然可用'
    }
  }
})

/**
 * 工具集合目录提示词：声明全部可选集合（id + 能力描述）与 load_tool_collection 用法。
 * 内容静态稳定，作为可缓存的 system 前缀的一部分；对齐 buildSkillCatalogPrompt 风格。
 */
export const buildToolCatalogPrompt = (): string => {
  if (toolGroups.length === 0) return ''
  const lines = toolGroups.map((g) => `- [${g.id}] ${g.group}：${g.description}`)
  return [
    '<available_tool_collections>',
    '以下是可按需装载的工具集合目录。这些集合的工具默认不在你的可用工具中，需要使用其中某组能力时，',
    '先调用 load_tool_collection 工具（ids 传集合 id，可一次多个）完成装载，再按返回的工具清单正常调用。',
    '',
    ...lines,
    '',
    '规则：',
    '- 装载仅在本次任务（本条用户消息起的一整轮）内有效，之后的轮次需要时重新装载一次即可。',
    '- 用户在界面勾选或专家声明的工具已经直接可用，无需装载。',
    '- 对话历史中出现过的工具不代表当前可用：集合未装载时不允许凭记忆直接调用其工具，必须先装载。',
    '</available_tool_collections>'
  ].join('\n')
}
