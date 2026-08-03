<template>
  <template v-if="!state.installed">
    <t-button
      :size="size"
      theme="primary"
      :variant="outline ? 'outline' : 'base'"
      @click.stop="emit('install')"
    >
      下载
    </t-button>
  </template>
  <template v-else>
    <t-button v-if="state.upgradable" :size="size" theme="primary" @click.stop="emit('upgrade')">
      升级
    </t-button>
    <t-button v-else :size="size" variant="outline" disabled>已安装</t-button>
    <t-button :size="size" theme="danger" variant="text" @click.stop="emit('uninstall', state.copies)">
      卸载
    </t-button>
  </template>
</template>
<script lang="ts" setup>
import type { LocalSkill } from '@/modules/skill'
import type { ApiSkill } from '@/modules/skillhub'
import { buildInstallState } from '../install-state'

const props = defineProps<{
  skill: ApiSkill
  locals: Array<LocalSkill>
  size?: 'small' | 'medium'
  outline?: boolean
}>()

const emit = defineEmits<{
  install: []
  upgrade: []
  uninstall: [copies: LocalSkill[]]
}>()

const state = computed(() => buildInstallState(props.skill, props.locals))
</script>
