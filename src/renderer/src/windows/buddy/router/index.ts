import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
// 引入路由

export const routes: Array<RouteRecordRaw> = [
  {
    name: 'redirect',
    path: '/',
    redirect: '/hardware/traffic-light'
  },
  {
    name: '硬件控制/红绿灯',
    path: '/hardware/traffic-light',
    component: () => import('@/windows/buddy/pages/hardware/traffic-light/TrafficLight.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
