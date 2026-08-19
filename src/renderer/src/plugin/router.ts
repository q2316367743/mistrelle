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
    component: () => import('@/pages/more/skill/index.vue')
  },
  {
    name: 'Agent',
    path: '/agent',
    component: () => import('@/pages/more/agent/PageAgent.vue')
  },
  {
    name: 'Tool',
    path: '/tool',
    component: () => import('@/pages/more/tool/PageTool.vue')
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

  // --------------------------------- 项目相关 ---------------------------------

  {
    name: '项目列表',
    path: '/project/list',
    component: () => import('@/pages/project/list/index.vue')
  },

  // --------------------------------- 设计 ---------------------------------

  {
    name: '设计/列表',
    path: '/design/list',
    component: () => import('@/pages/design/list/index.vue')
  },
  {
    name: '设计/详情',
    path: '/design/detail/:id',
    component: () => import('@/pages/design/detail/index.vue')
  },
  {
    name: '设置/字体管理',
    path: '/design/font',
    component: () => import('@/pages/design/font/DesignFontPage.vue')
  },

  // --------------------------------- 项目 ---------------------------------

  {
    path: '/project/:id',
    component: () => import('@/pages/project/detail/index.vue'),
    children: [
      {
        path: '',
        redirect: (to) => `/project/${(to.params as { id: string }).id}/dynamics`
      },
      {
        name: '项目-动态',
        path: 'dynamics',
        component: () => import('@/pages/project/dynamics/DynamicsPage.vue')
      },
      {
        name: '项目-计划',
        path: 'plan',
        component: () => import('@/pages/project/plan/PlanPage.vue')
      },
      {
        name: '项目-任务',
        path: 'task',
        component: () => import('@/pages/project/task/TaskPage.vue')
      },
      {
        name: '项目-聊天',
        path: 'chat/:chatId',
        component: () => import('@/pages/project/chat/ProjectChatPage.vue')
      },
      {
        name: '项目-资产',
        path: 'asset',
        component: () => import('@/pages/project/asset/AssetPage.vue')
      },
      {
        name: '项目-订阅',
        path: 'subscribe',
        component: () => import('@/pages/project/subscribe/SubscribePage.vue')
      },
      {
        name: '项目-笔记',
        path: 'note',
        component: () => import('@/pages/project/note/NotePage.vue')
      }
    ]
  },

  // --------------------------------- 设置 ---------------------------------

  {
    name: '设置/global',
    path: '/setting/global',
    component: () => import('@/pages/setting/global/SettingGlobalPage.vue')
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
  },
  {
    name: '设置/安全中心',
    path: '/setting/secure',
    component: () => import('@/pages/setting/secure/SettingSecurePage.vue')
  },
  {
    name: '设置/记忆',
    path: '/setting/soul',
    component: () => import('@/pages/setting/soul/SoulSettingPage.vue')
  },
  {
    name: '设置/个性化',
    path: '/setting/personalize',
    component: () => import('@/pages/setting/personalize/PersonalizePage.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
