<template>
  <page-layout title="安全中心">
    <!-- 总览 -->
    <div v-if="view === 'main'" class="security-page">
      <div class="security-subtitle">
        <span>统一管理工作空间内的进程安全、数据安全与系统授权</span>
        <t-tag variant="light" theme="default" class="subtitle-tag">
          安全能力由本地运行时提供
        </t-tag>
      </div>

      <div class="security-grid">
        <!-- 沙箱安全 -->
        <t-card class="security-card" :bordered="false">
          <div class="card-header">
            <div class="card-title-wrap">
              <t-icon name="secured" class="card-icon" />
              <div>
                <div class="card-title-row">
                  <span class="card-title">沙箱安全</span>
                  <t-tooltip content="AI 运行于隔离沙箱环境，可配置文件、命令与网络策略">
                    <t-icon name="help-circle" class="card-help" />
                  </t-tooltip>
                </div>
                <div class="card-desc">AI 运行于隔离沙箱，并配置文件、命令、网络访问策略</div>
              </div>
            </div>
            <t-switch v-model="state.sandbox.enabled" />
          </div>

          <SecuritySection
            icon="folder"
            title="文件安全"
            description="为沙箱拦截后的文件路径配置白名单和黑名单"
            arrow
            clickable
            @click="enter('file')"
          />
          <SecuritySection
            icon="terminal"
            title="命令安全"
            description="为命令前缀配置询问和放行名单"
            arrow
            clickable
            @click="enter('command')"
          />
          <SecuritySection
            icon="internet"
            title="网络安全"
            description="控制 URL 访问与沙箱网络域名规则"
            arrow
            clickable
            @click="enter('network')"
          />
        </t-card>

        <!-- 数据安全 -->
        <t-card class="security-card" :bordered="false">
          <div class="card-header">
            <div class="card-title-wrap">
              <t-icon name="lock-on" class="card-icon" />
              <div>
                <div class="card-title-row">
                  <span class="card-title">数据安全</span>
                </div>
                <div class="card-desc">数据流转及删除行为的安全防护</div>
              </div>
            </div>
          </div>

          <SecuritySection
            icon="secured"
            title="安全网关"
            description="工作空间出入流量统一经过安全网关安全处理"
          >
            <template #action>
              <t-tag theme="success" variant="light">已开启</t-tag>
            </template>
          </SecuritySection>

          <SecuritySection
            icon="secured"
            title="传输加密"
            description="本地与云端通信使用端到端加密通道"
          >
            <template #action>
              <t-tag theme="success" variant="light">已开启</t-tag>
            </template>
          </SecuritySection>

          <SecuritySection
            icon="folder-locked"
            title="删除保护"
            description="开启后优先移到废纸篓/回收站，关闭后按系统删除"
          >
            <template #action>
              <t-switch v-model="state.data.deleteProtection" />
            </template>
          </SecuritySection>

          <SecuritySection
            icon="folder-blocked"
            title="批量删除审批"
            description="需开启删除保护，一次删除达到该数量时需要审批"
          >
            <template #action>
              <t-input-number
                v-model="state.data.bulkDeleteApprovalThreshold"
                :min="0"
                :max="100000"
                :disabled="!state.data.deleteProtection"
                theme="normal"
                class="approval-input"
              />
            </template>
          </SecuritySection>
        </t-card>
      </div>

      <!-- 内置运行时 -->
      <t-card class="security-card runtime-card" :bordered="false">
        <div class="card-header">
          <div class="card-title-wrap">
            <t-icon name="cpu" class="card-icon" />
            <div>
              <div class="card-title-row">
                <span class="card-title">内置运行时</span>
              </div>
              <div class="card-desc">指定 Python、Node.js 与 Git 的可执行文件路径，留空则使用环境变量</div>
            </div>
          </div>
        </div>

        <RuntimeRow
          icon="terminal"
          name="Python"
          description="通用编程语言，适用于脚本编写、自动化和数据处理"
          placeholder="未设置则使用环境变量中的 Python"
          v-model="state.runtime.python"
        />
        <RuntimeRow
          icon="terminal"
          name="Node.js"
          description="基于 Chrome V8 引擎的 JavaScript 运行时，用于服务端开发"
          placeholder="未设置则使用环境变量中的 Node.js"
          v-model="state.runtime.node"
        />
        <RuntimeRow
          icon="git-branch"
          name="Git Bash"
          description="分布式版本控制工具，用于代码克隆与提交"
          placeholder="未设置则使用环境变量中的 Git"
          v-model="state.runtime.git"
        />
      </t-card>
    </div>

    <!-- 子详情：文件 / 命令 / 网络 -->
    <SandboxDetail v-else :active="view" @back="view = 'main'" />
  </page-layout>
</template>

<script lang="ts" setup>
import { useSettingSecureStore } from '@/store'
import SecuritySection from './components/SecuritySection.vue'
import RuntimeRow from './components/RuntimeRow.vue'
import SandboxDetail from './components/SandboxDetail.vue'

const { state } = toRefs(useSettingSecureStore())

/** 当前视图：总览 main，或进入某一子详情 */
type SecureView = 'main' | 'file' | 'command' | 'network'
const view = ref<SecureView>('main')

const enter = (target: SecureView) => {
  view.value = target
}
</script>

<style scoped lang="less">
.security-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 16px 16px;
}

.security-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
}

.security-card {
  border-radius: var(--td-radius-medium);
  box-shadow: var(--td-shadow-1);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 4px;
}

.card-title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.card-icon {
  font-size: 22px;
  color: var(--td-brand-color);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.card-help {
  font-size: 15px;
  color: var(--td-text-color-placeholder);
  cursor: help;
}

.card-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}

.security-subtitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--td-text-color-secondary);

  .subtitle-tag {
    flex: none;
  }
}

.approval-input {
  width: 140px;
}
</style>
