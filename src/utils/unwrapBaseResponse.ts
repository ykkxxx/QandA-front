import { showToast } from 'vant'
import type { BaseResponse } from '../types/apiResponse'
import { clearClientAuthState } from './clearClientAuthState'

function toastBizFailure(code: number, message: string): void {
  const msg = (message && message.trim()) || '请求失败'
  if (code === 40100) {
    showToast(msg || '登录已失效，请重新登录')
    clearClientAuthState()
    return
  }
  if (code === 42900) {
    showToast(msg || '请求过于频繁，请稍后再试')
    return
  }
  showToast(msg)
}

/**
 * 解析统一响应：`code === 0` 返回 `data`，否则 Toast 后抛错。
 * @throws Error 业务失败或响应格式异常
 */
export function unwrapBaseResponse<T>(body: unknown): T {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    showToast('响应格式异常')
    throw new Error('INVALID_RESPONSE_BODY')
  }
  const { code, data, message } = body as BaseResponse<T>
  if (typeof code !== 'number') {
    showToast('响应格式异常')
    throw new Error('INVALID_RESPONSE_CODE')
  }
  if (code === 0) {
    return data as T
  }
  toastBizFailure(code, typeof message === 'string' ? message : '')
  throw new Error(`BIZ_CODE_${code}`)
}
