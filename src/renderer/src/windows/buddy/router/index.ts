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
  },
  {
    name: '硬件控制/ESP32-S3-LCD-1.28',
    path: '/hardware/esp32-lcd',
    component: () => import('@/windows/buddy/pages/hardware/esp32-lcd/Esp32Lcd.vue')
  },
  {
    name: '插件/额度插件',
    path: '/plugins/quota',
    component: () => import('@/windows/buddy/pages/plugins/quota/QuotaPlugins.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
