import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { pinia } from './stores'

// 全局样式（令牌 + 重置 + 工具类）只在这里引入一次
import './styles/index.css'

createApp(App).use(pinia).use(router).mount('#app')
