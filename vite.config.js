import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 开发 / preview 共用，否则 `vite preview` 下 /api 不会转发，后端完全收不到请求 */
const devProxy = {
  // AI 相关（不动）
  '/api/agent': { target: 'http://127.0.0.1:8123', changeOrigin: true, ws: true },
  '/api/rag': { target: 'http://127.0.0.1:8123', changeOrigin: true },
  '/api/chat': { target: 'http://127.0.0.1:8123', changeOrigin: true },
  '/api/message': { target: 'http://127.0.0.1:8123', changeOrigin: true },
  '/api/session': { target: 'http://127.0.0.1:8123', changeOrigin: true },
  '/api/vector': { target: 'http://127.0.0.1:8123', changeOrigin: true },
  '/api/user': { target: 'http://127.0.0.1:8123', changeOrigin: true },

  // 用户接口：其余 /api → 8123
  '/api': {
    target: 'http://127.0.0.1:8123',
    changeOrigin: true
  },

  '/file': {
    target: 'http://127.0.0.1:8123',
    changeOrigin: true
  },

  /** 头像等静态资源：后端存 /files/avatars/...，须与 Spring 静态映射一致 */
  '/files': {
    target: 'http://127.0.0.1:8123',
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    host: true,
    proxy: devProxy
  },
  preview: {
    port: 4173,
    host: true,
    proxy: devProxy
  }
})