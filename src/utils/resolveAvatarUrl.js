/** 默认占位头像 */
export const DEFAULT_AVATAR =
  'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg';

/**
 * 静态资源（/files/**、/file/**）所在源，仅在使用环境变量时拼接。
 * 默认留空：开发走 Vite 代理到后端（见 vite.config.js 的 `/files`），生产走同源或网关反代。
 * 若必须直连后端静态端口，在 `.env.development` / `.env.production` 设置：
 *   VITE_STATIC_ORIGIN=http://127.0.0.1:8123
 * （后端须已配置 `/files/**` 的 ResourceHandler，否则会 404）
 */
function staticFilesOrigin() {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_STATIC_ORIGIN;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/$/, '');
  }
  return '';
}

/**
 * 将后端返回的头像字段转为可在当前页面加载的 URL。
 * - 绝对地址（http/https）原样返回（并修正历史错误 localhost:8001）
 * - 相对路径 `/files/...`：默认当前站点根路径（由代理或网关转到实际文件服务）
 */
export function resolveAvatarUrl(avatar) {
  if (avatar == null || String(avatar).trim() === '') return DEFAULT_AVATAR;
  let s = String(avatar).trim().replace(/\\/g, '/');
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

  const path = s.startsWith('/') ? s : `/${s}`;
  const origin = staticFilesOrigin();
  if (
    origin &&
    (path.startsWith('/files/') || path.startsWith('/file/'))
  ) {
    return `${origin}${path}`;
  }
  return path;
}
