import { getActivePinia } from 'pinia'
import { useUserStore } from '../store/user'
import router from '../router'

/** 清除本地登录态并跳转登录（用于 40100 等需重新登录场景） */
export function clearClientAuthState(): void {
  localStorage.removeItem('jwt_token')
  localStorage.removeItem('jwt_refresh_token')
  localStorage.removeItem('jwt_expires_at')
  const pinia = getActivePinia()
  if (pinia) {
    const s = useUserStore(pinia)
    s.userInfo = null
    s.token = ''
    s.refreshToken = ''
    s.tokenExpiresAt = null
    s.isLogin = false
  }
  router.push({ path: '/login', replace: true }).catch(() => {})
}
