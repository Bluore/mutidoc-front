import { createApp } from 'vue'
import { locale } from '@pixelium/web-vue/es'

import App from './App.vue'
import router from './router'
import { pinia } from './stores'

// 像素字体（Fusion Pixel）@font-face，供组件库的 --px-font 使用
import '@pixelium/web-vue/dist/font.css'
// 全局样式（令牌 + 重置 + 工具类）只在这里引入一次
import './styles/index.css'

// 开启像素字体与像素风基础样式（.pixelium 会应用 --px-font）
document.documentElement.classList.add('pixelium')
// 组件库内置文案中文化（对话框按钮、分页等）
locale.setLocale('zh-cn')

createApp(App).use(pinia).use(router).mount('#app')
