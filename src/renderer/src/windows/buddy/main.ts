import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import 'virtual:uno.css'
import '@/assets/style/global.less'

// 伙伴窗口入口：独立于主窗口（src/main.ts），页面见 ./pages/
createApp(App).use(createPinia()).use(router).mount('#app')
