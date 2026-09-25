import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
// 引入路由

export const routes: Array<RouteRecordRaw> = [
  {
    name: 'redirect',
    path: '/',
    redirect: '/new'
  },

  {
    name: 'Skill',
    path: '/skill',
    component: () => import('@/windows/main/pages/more/skill/index.vue')
  },
  {
    name: 'Agent',
    path: '/agent',
    component: () => import('@/windows/main/pages/more/agent/PageAgent.vue')
  },
  {
    name: 'Tool',
    path: '/tool',
    component: () => import('@/windows/main/pages/more/tool/PageTool.vue')
  },

  {
    name: '新建聊天',
    path: '/new',
    component: () => import('@/windows/main/pages/new/PageNew.vue')
  },
  {
    name: '聊天内容',
    path: '/chat/:id',
    component: () => import('@/windows/main/pages/chat/PageChat.vue')
  },

  // --------------------------------- 设计 ---------------------------------

  {
    name: '设计/列表',
    path: '/design/list',
    component: () => import('@/windows/main/pages/design/list/index.vue')
  },
  {
    name: '设计/卡片风格',
    path: '/design/card',
    component: () => import('@/windows/main/pages/design/card/DesginCardPage.vue')
  },
  {
    name: '设计/详情',
    path: '/design/detail/:id',
    component: () => import('@/windows/main/pages/design/detail/index.vue')
  },
  {
    name: '设计/在线详情',
    path: '/design/online/:id',
    component: () => import('@/windows/main/pages/design/detail/index.vue'),
    meta: { online: true }
  },
  {
    name: '设置/字体管理',
    path: '/design/font',
    component: () => import('@/windows/main/pages/design/font/DesignFontPage.vue')
  },

  // --------------------------------- 朝花夕拾（工具箱） ---------------------------------

  {
    name: '朝花夕拾/生图',
    path: '/attachment/image',
    component: () => import('@/windows/main/pages/extend/image/AttachmentImagePage.vue')
  },
  {
    name: '朝花夕拾/打水印',
    path: '/attachment/watermark',
    component: () => import('@/windows/main/pages/extend/watermark/index.vue')
  },
  {
    name: '朝花夕拾/去 AI 味儿',
    path: '/attachment/humanize',
    component: () => import('@/windows/main/pages/extend/humanize/index.vue')
  },

  // --------------------------------- 闲庭漫步 ---------------------------------

  {
    name: '闲庭漫步/笔记卡片',
    path: '/attachment/card',
    component: () => import('@/windows/main/pages/extend/card/index.vue')
  },
  {
    name: '闲庭漫步/可用性检测工具',
    path: '/attachment/test',
    component: () => import('@/windows/main/pages/extend/test/ExtendTestPage.vue')
  },
  {
    name: '闲庭漫步/模型对比检测',
    path: '/attachment/compare',
    component: () => import('@/windows/main/pages/extend/compare/ExtendComparePage.vue')
  },

  // --------------------------------- 设置 ---------------------------------

  {
    name: '设置/global',
    path: '/setting/global',
    component: () => import('@/windows/main/pages/setting/global/SettingGlobalPage.vue')
  },
  {
    name: '设置/account',
    path: '/setting/account',
    component: () => import('@/windows/main/pages/setting/account/SettingAccountPage.vue')
  },
  {
    name: '设置/ai',
    path: '/setting/ai',
    component: () => import('@/windows/main/pages/setting/ai/SettingAi.vue')
  },
  {
    name: '设置/网络',
    path: '/setting/network',
    component: () => import('@/windows/main/pages/setting/network/SettingNetwork.vue')
  },
  {
    name: '设置/default',
    path: '/setting/default',
    component: () => import('@/windows/main/pages/setting/default/SettingDefault.vue')
  },
  {
    name: '设置/安全中心',
    path: '/setting/secure',
    component: () => import('@/windows/main/pages/setting/secure/SettingSecurePage.vue')
  },
  {
    name: '设置/记忆',
    path: '/setting/soul',
    component: () => import('@/windows/main/pages/setting/soul/SoulSettingPage.vue')
  },
  {
    name: '设置/个性化',
    path: '/setting/personalize',
    component: () => import('@/windows/main/pages/setting/personalize/PersonalizePage.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
