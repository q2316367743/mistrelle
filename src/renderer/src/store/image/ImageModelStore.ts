/**
 * 服务端生图模型 store：文生图档位选项（/v1/images/models，服务端直出 label/value）。
 * 消费方：文生图表单、设置页「默认生图模型」下拉（options 直接绑定）；value 为档位 code，
 * 未登录时列表为空（needLogin 引导登录）。
 * 列表数据在 main 经 RelayService 代理获取（凭证不下发），本 store 只做缓存与登录态联动。
 */
import { defineStore } from 'pinia'
import { useAuthStore } from '@/store/AuthStore'

export const useImageModelStore = defineStore('imageModel', () => {
  /** 服务端档位选项（保持服务端排序；value = 档位 code） */
  const items = ref<ImageModelOption[]>([])
  const loading = ref(false)
  /** 未登录标记（生图服务可用性门控，UI 显示登录引导） */
  const needLogin = computed(() => useAuthStore().status !== 'signed-in')

  /** 拉取生图模型选项；未登录直接清空（登录后经 onChanged 自动刷新） */
  async function refresh(): Promise<void> {
    if (needLogin.value) {
      items.value = []
      return
    }
    loading.value = true
    try {
      items.value = await window.preload.image.getModels()
    } catch (error) {
      items.value = []
      console.error('[image-model] 获取生图模型列表失败', error)
    } finally {
      loading.value = false
    }
  }

  // store 单例，以下仅初始化一次：启动拉取 + 登录态变化自动刷新 / 清空
  void refresh()
  window.preload.auth.onChanged(() => {
    void refresh()
  })

  return { items, loading, needLogin, refresh }
})
