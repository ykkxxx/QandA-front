/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 管理员 API 根路径，如 `http://localhost:8123/api` 或开发时代理 `/api` */
  readonly VITE_ADMIN_API_BASE?: string
  /** 管理员密钥，勿提交真实值；本地可放 .env.local */
  readonly VITE_ADMIN_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
