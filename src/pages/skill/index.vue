<template>
  <page-layout title="Skill">
    <template #extra>
      <t-radio-group v-model="active" variant="primary-filled">
        <t-radio-button value="local">本地</t-radio-button>
        <t-radio-button value="skillhub">SkillHub</t-radio-button>
      </t-radio-group>
    </template>
    <div class="skill-page">
      <skill-local v-show="active === 'local'"></skill-local>
      <skill-hub v-show="active === 'skillhub'"></skill-hub>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import SkillLocal from '@/pages/skill/SkillLocal/SkillLocal.vue'
import SkillHub from '@/pages/skill/SkillHub/SkillHub.vue'

const active = ref('local')
</script>
<style scoped lang="less">
.skill-page {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 8px 8px;
  box-sizing: border-box;
  overflow: hidden;
}
</style>
