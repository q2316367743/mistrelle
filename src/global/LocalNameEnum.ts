export const LocalNameEnum = {
  KEY_APP_COLLAPSED: '/key/app/collapsed',
  KEY_AI_COMMON_MODEL: '/key/ai/common/model',

  SETTING_NETWORK: '/setting/network',
  SETTING_AI: '/setting/ai',
  SETTING_DEFAULT: '/setting/default',

  LIST_AI_GROUP: '/list/ai/group',
  LIST_AI_CHAT: (groupId: string) => `/list/ai/chat/${groupId}`,
  LIST_AI_DISCUSSION: '/list/ai/discussion',

  ITEM_AI_DISCUSSION: (id: string) => `/item/ai/discussion/${id}`
}
