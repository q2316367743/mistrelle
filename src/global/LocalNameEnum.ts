export const LocalNameEnum = {
  KEY_APP_COLLAPSED: '/key/app/collapsed',
  KEY_AI_COMMON_MODEL: '/key/ai/common/model',

  SETTING_NETWORK: '/setting/network',
  SETTING_AI: '/setting/ai',
  SETTING_DEFAULT: '/setting/default',

  LIST_AI_AGENT: '/list/ai/group',
  LIST_AI_CHAT: (groupId: string) => `/list/ai/chat/${groupId}`,
  LIST_AI_DISCUSSION: '/list/ai/discussion',
  LIST_AI_PROMPT: '/list/ai/prompt',
  LIST_NOTE_TRACE: '/list/note/trace',

  ITEM_AI_DISCUSSION: (id: string) => `/item/ai/discussion/${id}`,
  ITEM_AI_PROMPT: (id: string) => `/item/ai/prompt/${id}`,
  ITEM_NOTE_TRACE: (id: string | number) => `/item/note/trace/${id}`
}
