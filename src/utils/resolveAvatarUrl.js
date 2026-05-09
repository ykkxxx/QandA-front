/** 默认占位头像 */
export const DEFAULT_AVATAR =
  'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg';

/**
 * 将后端返回的头像字段转为可在当前页面加载的 URL。
 * - 使用相对路径时走当前站点（开发环境由 Vite 代理到用户服务）
 * - 修正历史错误的 localhost:8001 前缀
 */
export function resolveAvatarUrl(avatar) {
  if (avatar == null || String(avatar).trim() === '') return DEFAULT_AVATAR;
  const s = String(avatar).trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const legacyBadPort =
        (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
        u.port === '8001';
      if (legacyBadPort) {
        const path = u.pathname + u.search;
        return path || DEFAULT_AVATAR;
      }
    } catch {
      return s;
    }
    return s;
  }
  return s.startsWith('/') ? s : `/${s}`;
}
