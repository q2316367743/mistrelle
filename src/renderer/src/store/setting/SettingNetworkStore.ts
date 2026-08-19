import { defineStore } from 'pinia'
import { buildSettingNetwork, SettingNetwork } from '@/entity'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { AxiosProxyConfig, AxiosRequestConfig } from 'axios'
import { getSettingNetworkPath } from '@/global/Constant'
import { useLog } from '@/hooks/UseLog'

export const useSettingNetworkStore = defineStore('setting:network', () => {
  const logger = useLog({ name: 'store:setting-network' })
  const setting = ref<SettingNetwork>(buildSettingNetwork())

  ;(async () => {
    const network = await readJsonFile<SettingNetwork>(getSettingNetworkPath())
    if (network) setting.value = network

    watchDebounced(
      setting,
      async (val) => {
        await writeJsonFile(getSettingNetworkPath(), val)
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
