/** 后端统一包装：`code === 0` 表示成功 */
export interface BaseResponse<T> {
  code: number
  data: T | null
  message: string
}

/** POST /chat/document 成功时的 data */
export interface DocumentUploadData {
  sourceFile: string
  chunkCount: number
  message: string
}

/** POST /rag/context 成功时的 data */
export interface RagContextData {
  chunks: Array<Record<string, unknown>>
  contextText: string
  llmUserContent: string
}

/** POST /chat/send 成功时的 data（与 message/send 二选一，此处仅作类型预留） */
export interface ChatSendData {
  sessionId: string
  content: string
}
