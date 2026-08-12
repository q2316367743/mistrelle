<template>
  <div class="sandbox-detail">
    <header class="detail-header">
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        class="shrink-0"
        @click="emit('back')"
      >
        <template #icon>
          <chevron-left-icon />
        </template>
      </t-button>
      <div class="detail-title">{{ titleMap[active] }}</div>
      <div class="detail-subtitle">{{ subtitleMap[active] }}</div>
    </header>

    <div class="detail-body">
      <!-- 文件安全 -->
      <template v-if="active === 'file'">
        <div class="notice-card">
          <div class="notice-row">
            <t-icon name="info-circle" class="notice-icon" />
            <div class="notice-content">
              <div class="notice-title">文件安全说明</div>
              <div class="notice-desc">
                文件黑/白名单只在沙箱已经拦截文件操作后生效；不会主动拦截沙箱默认允许的访问。
              </div>
            </div>
            <t-button variant="outline" @click="resetFileBlackList">重置默认</t-button>
          </div>
        </div>

        <SecurityListEditor
          icon="check-circle"
          title="自动放行白名单"
          description="命中路径会按低风险处理并自动放行。"
          v-model="state.sandbox.fileWhiteList"
          item-icon="folder"
          placeholder="例如：~/.cache/myapp/"
          show-picker
          picker-title="新增路径"
        />

        <SecurityListEditor
          icon="close-circle"
          title="强制审批黑名单"
          description="命中路径发生编辑行为（写入/删除）时会按高风险处理并强制弹出审批。"
          v-model="state.sandbox.fileBlackList"
          :default-list="defaultBlackList"
          item-icon="folder"
          placeholder="输入路径后回车"
          show-picker
          picker-title="新增路径"
        />
      </template>

      <!-- 命令安全 -->
      <template v-else-if="active === 'command'">
        <div class="notice-card">
          <div class="notice-row">
            <t-icon name="info-circle" class="notice-icon" />
            <div class="notice-content">
              <div class="notice-title">命令安全说明</div>
              <div class="notice-desc">
                放行名单会跳过敏感命令检测并自动放行；请谨慎放行 cat、bash
                等通用命令。询问名单会在执行前弹出审批。
              </div>
            </div>
          </div>
        </div>

        <SecurityListEditor
          icon="check-circle"
          title="放行名单"
          description="命中后跳过敏感命令检测，并在沙箱文件拦截后自动放行；请谨慎放行 cat、bash 等通用命令。"
          v-model="state.sandbox.commandWhiteList"
          item-icon="terminal"
          placeholder="例如：git"
        />

        <SecurityListEditor
          icon="help-circle"
          title="询问名单"
          description="命中后先弹出审批，通过后继续在沙箱中执行。"
          v-model="state.sandbox.commandAskList"
          item-icon="terminal"
          placeholder="例如：rm"
        />
      </template>

      <!-- 网络安全 -->
      <template v-else>
        <div class="notice-card">
          <div class="notice-row">
            <t-icon name="info-circle" class="notice-icon" />
            <div class="notice-content">
              <div class="notice-title">网络安全说明</div>
              <div class="notice-desc">
                开启「阻断全部网络访问」后，仅允许域名列表会作为例外放行；拒绝域名列表始终生效。
              </div>
            </div>
          </div>
        </div>

        <div class="switch-card">
          <div class="switch-row">
            <div>
              <div class="switch-title">阻断所有网络访问</div>
              <div class="switch-desc">开启后默认阻断网络访问，仅允许域名列表会作为例外放行</div>
            </div>
            <t-switch v-model="state.sandbox.blockAllNetworkAccess" />
          </div>
        </div>

        <SecurityListEditor
          icon="check-circle"
          title="允许域名"
          description="开启全部阻止时，这些域名会作为例外放行。"
          v-model="state.sandbox.allowDomain"
          item-icon="internet"
          placeholder="例如：api.example.com"
        />

        <SecurityListEditor
          icon="close-circle"
          title="拒绝域名"
          description="沙箱内禁止访问的域名黑名单。"
          v-model="state.sandbox.rejectDomain"
          item-icon="internet"
          placeholder="例如：ads.example.com"
        />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ChevronLeftIcon } from 'tdesign-icons-vue-next'
import { useSettingSecureStore } from '@/store'
import { buildSettingSecure } from '@/entity/setting/SettingSecured'
import SecurityListEditor from './SecurityListEditor.vue'

const props = defineProps<{
  active: 'file' | 'command' | 'network'
}>()

const emit = defineEmits<{
  back: []
}>()

const { state } = toRefs(useSettingSecureStore())

const titleMap = {
  file: '文件安全',
  command: '命令安全',
  network: '网络安全'
} as const

const subtitleMap = {
  file: '为沙箱拦截后的文件路径配置白名单和黑名单',
  command: '为命令前缀配置询问和放行名单',
  network: '控制 URL 访问与沙箱网络域名规则'
} as const

const defaultBlackList = buildSettingSecure().sandbox.fileBlackList

/** 将强制审批黑名单重置为实体默认值 */
const resetFileBlackList = () => {
  state.value.sandbox.fileBlackList = [...defaultBlackList]
}
</script>

<style scoped lang="less">
.sandbox-detail {
  display: flex;
  flex-direction: column;
  padding: 8px 16px 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0 16px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.detail-subtitle {
  margin-left: 12px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.notice-card,
.switch-card {
  display: flex;
  padding: 16px;
  background-color: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
}

.notice-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.notice-icon {
  flex: none;
  margin-top: 2px;
  font-size: 20px;
  color: var(--td-brand-color);
}

.notice-content {
  flex: 1;
  min-width: 0;
}

.notice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.notice-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.switch-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.switch-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}
</style>
