import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
// 引入路由

export const routes: Array<RouteRecordRaw> = [
  {
    name: 'redirect',
    path: '/',
    redirect: '/new'
  },

  {
    name: '提示词管理',
    path: '/prompt',
    component: () => import('@/pages/prompt/PagePrompt.vue')
  },
  {
    name: 'Skill',
    path: '/skill',
    component: () => import('@/pages/skill/index.vue')
  },
  {
    name: 'Agent',
    path: '/agent',
    component: () => import('@/pages/agent/PageAgent.vue')
  },

  {
    name: '新建聊天',
    path: '/new',
    component: () => import('@/pages/new/PageNew.vue')
  },
  {
    name: '聊天内容',
    path: '/chat/:id',
    component: () => import('@/pages/chat/PageChat.vue')
  },
  {
    name: '讨论组',
    path: '/discussion/:id',
    component: () => import('@/pages/discussion/PageDiscussion.vue')
  },

  {
    name: 'note/自我',
    path: '/note/ego',
    component: () => import('@/pages/note/ego/index.vue')
  },
  {
    name: 'note/本我',
    path: '/note/id',
    component: () => import('@/pages/note/id/index.vue')
  },
  {
    name: 'note/超我',
    path: '/note/superego/home',
    component: () => import('@/pages/note/superego/home/index.vue')
  },

  {
    name: '设置/account',
    path: '/setting/account',
    component: () => import('@/pages/setting/account/SettingAccountPage.vue')
  },
  {
    name: '设置/ai',
    path: '/setting/ai',
    component: () => import('@/pages/setting/ai/SettingAi.vue')
  },
  {
    name: '设置/网络',
    path: '/setting/network',
    component: () => import('@/pages/setting/network/SettingNetwork.vue')
  },
  {
    name: '设置/default',
    path: '/setting/default',
    component: () => import('@/pages/setting/default/SettingDefault.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
