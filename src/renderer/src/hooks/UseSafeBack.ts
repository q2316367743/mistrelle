import { useRouter, useRoute } from 'vue-router'

export function useSafeBack(fallback = '/') {
  const router = useRouter()
  const route = useRoute()

  return () => {
    const prevFullPath = route.fullPath

    router.back()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setTimeout(() => {
      // 如果路径仍然相同，认为 back 失效
      if (route.fullPath === prevFullPath) {
        console.warn('[SafeBack] back failed, force fallback')
        router.replace(fallback)
      }
    }, 300) // 200~500ms 都行
  }
}
