<template>
  <t-list class="setting-list" split size="small">
    <t-list-item>
      <t-list-item-meta title="User-Agent" description="自定义请求头标识，留空则随机使用" />
      <template #action>
        <div class="flex items-center gap-8px">
          <t-select
            v-model="selectedUaPreset"
            class="w-160px"
            placeholder="快速选择"
            :options="uaPresets"
            @change="onUaPresetChange"
          />
          <t-input
            v-model="setting.userAgent"
            class="flex-1"
            style="width: 300px"
            placeholder="请输入 User-Agent，为空则随机"
            allow-clear
          />
        </div>
      </template>
    </t-list-item>

    <t-list-item>
      <t-list-item-meta title="连接超时时间" description="建立网络连接的最大等待时间" />
      <template #action>
        <div class="flex items-center gap-8px">
          <t-input-number
            v-model="setting.connectTimeout"
            :min="0"
            :max="120"
            style="width: 120px"
            theme="normal"
            suffix="秒"
          />
        </div>
      </template>
    </t-list-item>

    <t-list-item>
      <t-list-item-meta title="读取超时时间" description="等待服务器响应数据的最大时间" />
      <template #action>
        <div class="flex items-center gap-8px">
          <t-input-number
            v-model="setting.readTimeout"
            :min="0"
            :max="300"
            style="width: 120px"
            theme="normal"
            suffix="秒"
          />
        </div>
      </template>
    </t-list-item>

    <t-list-item>
      <t-list-item-meta title="忽略 TLS 证书错误" description="是否忽略 HTTPS 证书验证错误" />
      <template #action>
        <t-switch v-model="setting.ignoreTlsCertError" />
      </template>
    </t-list-item>

    <t-list-item>
      <t-list-item-meta title="代理模式" description="选择是否使用代理及代理类型" />
      <template #action>
        <t-radio-group v-model="setting.proxyMode">
          <t-radio :value="1">无代理</t-radio>
          <t-radio :value="2">自定义代理</t-radio>
        </t-radio-group>
      </template>
    </t-list-item>

    <template v-if="setting.proxyMode === 2">
      <t-list-item>
        <t-list-item-meta title="代理类型" description="选择代理协议类型" />
        <template #action>
          <t-select v-model="setting.proxyType" class="w-200px">
            <t-option value="http" label="HTTP" />
            <t-option value="https" label="HTTPS" />
            <t-option value="socket5" label="SOCKS5" />
          </t-select>
        </template>
      </t-list-item>

      <t-list-item>
        <t-list-item-meta title="代理主机" description="代理服务器的地址或域名" />
        <template #action>
          <t-input
            v-model="setting.proxyHost"
            class="w-300px"
            placeholder="请输入代理主机地址"
            allow-clear
          />
        </template>
      </t-list-item>

      <t-list-item>
        <t-list-item-meta title="代理端口" description="代理服务器的端口号" />
        <template #action>
          <t-input-number
            v-model="setting.proxyPort"
            :min="0"
            :max="65535"
            style="width: 150px"
            placeholder="请输入代理端口"
          />
        </template>
      </t-list-item>

      <t-list-item>
        <t-list-item-meta title="代理用户名" description="代理服务器认证用户名（可选）" />
        <template #action>
          <t-input
            v-model="setting.proxyUsername"
            class="w-300px"
            placeholder="可选，代理认证用户名"
            allow-clear
          />
        </template>
      </t-list-item>

      <t-list-item>
        <t-list-item-meta title="代理密码" description="代理服务器认证密码（可选）" />
        <template #action>
          <t-input
            v-model="setting.proxyPassword"
            class="w-300px"
            type="password"
            placeholder="可选，代理认证密码"
            allow-clear
          />
        </template>
      </t-list-item>
    </template>
  </t-list>
</template>
<script lang="ts" setup>
import { useSettingNetworkStore } from '@/store'

const { setting } = toRefs(useSettingNetworkStore())

const uaPresets = [
  {
    label: 'PC - Chrome',
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  {
    label: 'PC - Firefox',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  },
  {
    label: 'PC - Edge',
    value:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
  },
  {
    label: 'Mac - Chrome',
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  {
    label: 'Mac - Safari',
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  },
  {
    label: 'iPhone - Safari',
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
  },
  {
    label: 'Android - Chrome',
    value:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36'
  },
  {
    label: 'iPad - Safari',
    value:
      'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
  }
]

const selectedUaPreset = ref<string>('')

function onUaPresetChange(value: unknown) {
  if (value) {
    setting.value.userAgent = `${value}`
  }
}
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 16px 16px 16px;
}
</style>
