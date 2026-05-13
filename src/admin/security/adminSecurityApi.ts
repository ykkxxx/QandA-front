import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  isAxiosError
} from 'axios'
import { showToast } from 'vant'
import type { BaseResponse, BlacklistPage } from './types'

/** 管理员 API Base（不含末尾 `/`） */
export function resolveAdminApiBase(): string {
  const raw = import.meta.env.VITE_ADMIN_API_BASE
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '')
  }
  return 'http://localhost:8123/api'
}

function unwrapAdminBody<T>(body: unknown): T | null {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    showToast('响应格式异常')
    throw new Error('INVALID_ADMIN_RESPONSE')
  }
  const b = body as BaseResponse<T>
  if (typeof b.code !== 'number') {
    showToast('响应格式异常')
    throw new Error('INVALID_ADMIN_RESPONSE')
  }
  if (b.code === 0) {
    return (b.data ?? null) as T | null
  }
  if (b.code === 40101) {
    showToast(b.message || '无效的管理员凭证')
    throw new Error('NO_AUTH_ERROR')
  }
  showToast((typeof b.message === 'string' && b.message) || '请求失败')
  throw new Error(`ADMIN_BIZ_${b.code}`)
}

function extractAxiosMessage(e: unknown): string {
  if (!isAxiosError(e)) return '请求失败'
  const d = e.response?.data as Record<string, unknown> | undefined
  if (d && typeof d.message === 'string') return d.message
  return e.message || '网络异常'
}

async function unwrapAdminResponse<T>(p: Promise<AxiosResponse<unknown>>): Promise<T | null> {
  try {
    const res = await p
    return unwrapAdminBody<T>(res.data)
  } catch (e) {
    if (isAxiosError(e) && e.response?.data != null) {
      try {
        return unwrapAdminBody<T>(e.response.data)
      } catch (biz) {
        throw biz
      }
    }
    if (isAxiosError(e)) {
      showToast(extractAxiosMessage(e))
    }
    throw e
  }
}

const PREFIX = '/admin/security'

/**
 * 管理员安全专用 axios：仅带 `X-Admin-Token`，与业务用户 axios 分离。
 * @param getToken 每次请求前读取密钥（如从输入框 / sessionStorage）
 */
export function createAdminSecurityClient(getToken: () => string): AxiosInstance {
  const client = axios.create({
    baseURL: resolveAdminApiBase(),
    headers: {
      'Content-Type': 'application/json'
    }
  })

  client.interceptors.request.use((config) => {
    const t = getToken().trim()
    config.headers = AxiosHeaders.from(config.headers ?? {})
    config.headers.set('X-Admin-Token', t)
    return config
  })

  return client
}

export function adminBanUser(
  client: AxiosInstance,
  body: { userId: string; reason?: string }
): Promise<null> {
  return unwrapAdminResponse<null>(client.post(`${PREFIX}/ban/user`, body)) as Promise<null>
}

export function adminUnbanUser(client: AxiosInstance, body: { userId: string }): Promise<null> {
  return unwrapAdminResponse<null>(client.post(`${PREFIX}/unban/user`, body)) as Promise<null>
}

export function adminBlacklistIp(
  client: AxiosInstance,
  body: { ip: string; reason?: string }
): Promise<null> {
  return unwrapAdminResponse<null>(client.post(`${PREFIX}/blacklist/ip`, body)) as Promise<null>
}

export function adminUnblacklistIp(client: AxiosInstance, ip: string): Promise<null> {
  return unwrapAdminResponse<null>(
    client.delete(`${PREFIX}/blacklist/ip`, { params: { ip } })
  ) as Promise<null>
}

export function adminBlacklistUsername(
  client: AxiosInstance,
  body: { username: string; reason?: string }
): Promise<null> {
  return unwrapAdminResponse<null>(client.post(`${PREFIX}/blacklist/username`, body)) as Promise<null>
}

export function adminUnblacklistUsername(client: AxiosInstance, username: string): Promise<null> {
  return unwrapAdminResponse<null>(
    client.delete(`${PREFIX}/blacklist/username`, { params: { username } })
  ) as Promise<null>
}

export function adminGetBlacklistPage(
  client: AxiosInstance,
  params: { page?: number; size?: number }
): Promise<BlacklistPage | null> {
  const page = params.page ?? 1
  const size = Math.min(params.size ?? 20, 100)
  return unwrapAdminResponse<BlacklistPage>(
    client.get(`${PREFIX}/blacklist`, { params: { page, size } })
  ) as Promise<BlacklistPage | null>
}
