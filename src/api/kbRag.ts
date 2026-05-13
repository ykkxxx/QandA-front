import axios, { isAxiosError } from 'axios'
import { apiConfig } from '../config/api'
import { bearerAuthHeaders } from '../utils/authToken'
import { unwrapBaseResponse } from '../utils/unwrapBaseResponse'
import { showToast } from 'vant'
import type { BaseResponse, DocumentUploadData, RagContextData } from '../types/apiResponse'

function extractAxiosErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return '请求失败，请稍后再试'
  const d = error.response?.data as Record<string, unknown> | undefined
  if (!d) return error.message || '请求失败，请稍后再试'
  if (typeof d.message === 'string') return d.message
  if (typeof d.msg === 'string') return d.msg
  if (typeof d.detail === 'string') return d.detail
  return error.message || '请求失败，请稍后再试'
}

function tryUnwrapAxiosResponseData<T>(data: unknown): T {
  return unwrapBaseResponse<T>(data)
}

const TXT_PDF = /\.(txt|pdf)$/i

function isAllowedKbFile(file: File): boolean {
  if (TXT_PDF.test(file.name)) return true
  const t = (file.type || '').toLowerCase()
  return t === 'application/pdf' || t === 'text/plain'
}

/**
 * 知识库文档入库：`multipart/form-data`，字段名 `file`。
 * 使用 `axios.post` + `FormData`，与 `store/user` 头像上传一致；勿手写 `Content-Type`。
 */
export async function uploadKbDocument(file: File): Promise<DocumentUploadData> {
  if (!isAllowedKbFile(file)) {
    showToast('仅支持 .txt、.pdf')
    throw new Error('INVALID_FILE_TYPE')
  }
  const token = localStorage.getItem('jwt_token')
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await axios.post<BaseResponse<DocumentUploadData>>(
      apiConfig.endpoints.chatDocument,
      form,
      {
        headers: {
          ...bearerAuthHeaders(token)
        }
      }
    )
    return tryUnwrapAxiosResponseData<DocumentUploadData>(res.data)
  } catch (e) {
    if (isAxiosError(e) && e.response?.data != null) {
      try {
        return tryUnwrapAxiosResponseData<DocumentUploadData>(e.response.data)
      } catch (bizErr) {
        throw bizErr
      }
    }
    showToast(extractAxiosErrorMessage(e))
    throw e
  }
}

/** RAG 上下文预览（仅检索拼接，不调大模型） */
export async function fetchRagContext(question: string): Promise<RagContextData> {
  const q = question.trim()
  if (!q) {
    showToast('请输入问题')
    throw new Error('EMPTY_QUESTION')
  }
  const token = localStorage.getItem('jwt_token')
  try {
    const res = await axios.post<BaseResponse<RagContextData>>(
      apiConfig.endpoints.ragContext,
      { question: q },
      {
        headers: {
          'Content-Type': 'application/json',
          ...bearerAuthHeaders(token)
        }
      }
    )
    return tryUnwrapAxiosResponseData<RagContextData>(res.data)
  } catch (e) {
    if (isAxiosError(e) && e.response?.data != null) {
      try {
        return tryUnwrapAxiosResponseData<RagContextData>(e.response.data)
      } catch (bizErr) {
        throw bizErr
      }
    }
    showToast(extractAxiosErrorMessage(e))
    throw e
  }
}
