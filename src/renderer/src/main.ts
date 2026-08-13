import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './plugin/router'
import '@/plugin/monaco' // 副作用：配置 MonacoEnvironment worker

import 'virtual:uno.css'
import '@/assets/style/global.less'

// 额外引入图标库
createApp(App).use(createPinia()).use(router).mount('#app')
