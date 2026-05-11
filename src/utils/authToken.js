/**
 * 规范化 JWT 字符串：去首尾空白，去掉已带的 Bearer 前缀（避免 Authorization 出现 Bearer Bearer）。
 */
export function normalizeJwtToken(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  let t = raw.trim();
  if (/^Bearer\s+/i.test(t)) {
    t = t.replace(/^Bearer\s+/i, '').trim();
  }
  return t;
}

/**
 * OAuth2 常见写法：仅 Authorization Bearer。
 * 不再附带 satoken 头，避免与 Sa-Token 或自定义解析逻辑抢读同一请求上的「会话串」导致误判。
 */
export function bearerAuthHeaders(rawToken) {
  const t = normalizeJwtToken(rawToken);
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}
