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

  // --------------------------------- 项目相关 ---------------------------------

  {
    name: '项目列表',
    path: '/project/list',
    component: () => import('@/pages/project/list/index.vue')
  },
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
    name: '设置/资源管理',
    path: '/setting/assets',
    component: () => import('@/pages/setting/assets/SettingAssetPage.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
