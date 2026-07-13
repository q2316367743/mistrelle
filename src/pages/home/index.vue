<template>
  <page-layout title="首页">
    <div class="p-8px">
      <t-alert>uTools开发脚手架</t-alert>

      <l-chat-sender v-model:input="content" v-model:model="model" />
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
const content = ref('')
const model = ref('')
</script>
<style scoped lang="less"></style>
