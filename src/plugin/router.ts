import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
// 引入路由

export const routes: Array<RouteRecordRaw> = [
  {
    name: 'redirect',
    path: '/',
    redirect: '/home'
  },
  {
    name: '主页',
    path: '/home',
    alias: ['/'],
    component: () => import('@/pages/home/index.vue')
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
