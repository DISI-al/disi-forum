import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 全局样式（不再依赖 CDN）：基础重置 + Markdown 正文排版
import './style.css'
import './styles/markdown.css'

createApp(App).use(router).mount('#app')
