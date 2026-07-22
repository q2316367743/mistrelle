<template>
  <page-layout :title="discussion?.name || '讨论组'">
    <template #extra>
      <t-radio-group v-model="active" variant="primary-filled">
        <t-radio-button value="chat">聊天</t-radio-button>
        <t-radio-button value="meeting">会议</t-radio-button>
      </t-radio-group>
    </template>
    <discussion-chat v-show="active === 'chat'" />
    <discussion-meeting v-show="active === 'meeting'" />
  </page-layout>
</template>

<script setup lang="ts">
import { AiDiscussion } from '@/entity/ai'
import DiscussionMeeting from '@/pages/discussion/meeting/DiscussionMeeting.vue'
import DiscussionChat from '@/pages/discussion/chat/DiscussionChat.vue'

const active = ref('chat')
const discussion = ref<AiDiscussion>()
</script>

<style scoped lang="less"></style>
