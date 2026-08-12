import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { ProjectAssetTreeNode } from '@/modules/project'
import type { ChatFileRef } from '@/utils/chatSender'

export interface ProjectAssetContext {
  tree: Ref<ProjectAssetTreeNode[]>
  files: ComputedRef<ChatFileRef[]>
  loading: Ref<boolean>
  refresh: () => Promise<void>
}

export const projectAssetContextKey: InjectionKey<ProjectAssetContext> = Symbol('projectAssetContext')
