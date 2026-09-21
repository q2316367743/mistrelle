import { defineStore } from 'pinia'
import { buildSettingNetwork, type SettingNetwork } from '@/entity'
import { AxiosProxyConfig, AxiosRequestConfig } from 'axios'
import { useLog } from '@/hooks/UseLog'

/**
 * 网络设置 store（视图层）：数据家在 main（内存缓存 + 写时刷新，保存即生效）。
 * 加载经 IPC 拉取、保存经 IPC 落盘（watchDebounced 防抖），本 store 只承载 UI 绑定
 * 与渲染层自身 HTTP（plugin/http.ts）的 fillAxiosConfig 注入。
 */
export const useSettingNetworkStore = defineStore('setting:network', () => {
  const logger = useLog({ name: 'store:setting-network' })
  const setting = ref<SettingNetwork>(buildSettingNetwork())

  ;(async () => {
    const network = await window.preload.network.getSetting()
    setting.value = network

    watchDebounced(
      setting,
      async (val) => {
        await window.preload.network.saveSetting(val)
      },
      { debounce: 300, deep: true }
    )
  })()
    .then(() => logger.debug('设置-网络 初始化成功'))
    .catch((e) => logger.error('设置-网络 初始化失败', e))

  const proxy = computed<AxiosProxyConfig | false>(() => {
    if (setting.value.proxyMode !== 2) {
      return false
    }
    const p: AxiosProxyConfig = {
      host: setting.value.proxyHost,
      port: setting.value.proxyPort,
      protocol: setting.value.proxyType
    }
    if (setting.value.proxyUsername && setting.value.proxyPassword) {
      p.auth = {
        username: setting.value.proxyUsername,
        password: setting.value.proxyPassword
      }
    }
    return p
  })

  const fillAxiosConfig = (config: AxiosRequestConfig) => {
    if (setting.value.userAgent) {
      config.headers = {
        'User-Agent': setting.value.userAgent,
        ...config.headers
      }
    }
    if (proxy.value) {
      config.proxy = proxy.value
    }
    config.timeout = setting.value.connectTimeout * 1000
    config.maxRedirects = setting.value.maxRedirects
  }

  return {
    setting,
    fillAxiosConfig
  }
})
