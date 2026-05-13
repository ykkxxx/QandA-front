/**
 * API配置文件
 * 包含API基础URL和所有API端点配置
 */

// API基础URL配置
export const apiConfig = {
  // 后端API基础URL（使用相对路径，通过Vite代理访问）
  baseURL: '',
  // 用户服务基础URL（使用相对路径，通过Vite代理访问）
  userBaseURL:  '/api',//'http://127.0.0.1:8123'
  
  // API端点配置
  endpoints: {
    // 认证相关
    login: '/api/user/login',
    logout: '/api/user/logout/',
    register: '/api/user/register',
    profile: '/api/user/info',
    updateProfile: '/api/user/update',
    resetPassword: '/api/user/reset-pwd',
    refreshToken: '/api/user/refresh-token',
    changePassword: '/api/user/reset-pwd',
    
    // 文件上传
    uploadFile: '/file/upload/',
    
    // AI对话相关（流式路径若与后端不一致，可在 .env 中设置 VITE_AGENT_QUERY_STREAM）
    agentQuery: '/api/agent/query',
    agentQueryStream:
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_QUERY_STREAM) ||
      '/api/agent/query/stream',
    
    // RAG相关
    ragQuery: '/api/rag/query',
    ragContext: '/api/rag/context',
    chatDocument: '/api/chat/document',
    
    // 会话消息（MessageController：/api/message）
    messageSend: '/api/message/send',
    messageList: '/api/message/list/',

    // 会话管理（与 Spring SessionController：/api/session 一致）
    createSession: '/api/session',
    getSession: '/api/session/',
    deleteSession: '/api/session/',
    getAllSessions: '/api/session/sessions',
    getUserSessions: '/api/session/sessions',
    
    // 向量数据库
    uploadSingleFile: '/api/vector/add/single',
    uploadMultipleFiles: '/api/vector/add/multiple',
    cleanVectors: '/api/vector/clean',
    
    // 文档重排序
    reorderDocuments: '/api/reorder'
  }
}