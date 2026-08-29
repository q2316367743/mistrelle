import { createApp } from 'vue'
import App from './ToolbarApp.vue'
import 'virtual:uno.css'
import '@/assets/style/global.less'

// 工作条独立入口：轻量秒开，不挂 router / pinia / monaco（与主应用 src/main.ts 区分）
createApp(App).mount('#app')
