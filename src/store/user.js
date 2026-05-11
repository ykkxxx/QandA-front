import { defineStore } from 'pinia';
import axios from 'axios';
import { apiConfig } from '../config/api';
import { bearerAuthHeaders, normalizeJwtToken } from '../utils/authToken';

// 从cookie中获取CSRF token
const getCsrfToken = () => {
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  return cookieValue || '';
};

/** 从 LoginData / 各项目习惯字段中取 token（含 Sa-Token、JWT 常见命名） */
const pickLoginToken = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  return (
    data.access_token ??
    data.accessToken ??
    data.token ??
    data.tokenValue ??
    data.satoken ??
    data.saToken
  );
};

/** 从 LoginData<UsersLoginVO> 等结构中取用户信息 */
const pickLoginUserInfo = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  return (
    data.user ??
    data.userInfo ??
    data.usersLoginVO ??
    data.loginUser ??
    data.users ??
    data.vo ??
    data.loginVo
  );
};

const pickRefreshToken = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  return data.refresh_token ?? data.refreshToken;
};

/** 访问令牌剩余有效时间（秒），如 OAuth 风格 LoginData.expires_in */
const pickExpiresIn = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const x = data.expires_in ?? data.expiresIn;
  if (typeof x === 'number' && Number.isFinite(x) && x > 0) return x;
  if (typeof x === 'string' && /^\d+$/.test(x)) {
    const n = parseInt(x, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
};

/**
 * 用户服务统一响应：BaseResponse 常见 code=0 / 200 或 success=true，负载在 data（LoginData）内。
 * 典型登录 data：access_token、refresh_token、expires_in、token_type、user（UsersLoginVO）
 */
const parseUserServiceResponse = (response) => {
  const body = response?.data ?? {};
  const ok =
    body.code === 0 ||
    body.code === 200 ||
    body.success === true;
  const data = body.data;
  const inner =
    data != null && typeof data === 'object' && !Array.isArray(data) ? data : {};

  return {
    ok,
    token: pickLoginToken(inner),
    refreshToken: pickRefreshToken(inner),
    userInfo: pickLoginUserInfo(inner),
    expiresIn: pickExpiresIn(inner),
    message: body.message || body.msg || '操作成功'
  };
};

/** 写操作：HTTP 2xx 且（无 code 字段 或 code===0）为成功 */
const interpretUserWriteResponse = (response) => {
  const status = response?.status ?? 0;
  if (status < 200 || status >= 300) {
    return { success: false, message: '' };
  }
  const body = response?.data;
  if (
    body != null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, 'code')
  ) {
    const codeOk = body.code === 0 || body.code === 200;
    if (!codeOk) {
      return {
        success: false,
        message: body.message || body.msg || '操作失败'
      };
    }
  }
  const msg =
    body && typeof body === 'object' && !Array.isArray(body)
      ? body.message || body.msg
      : undefined;
  return {
    success: true,
    message: msg || '操作成功'
  };
};

const extractAxiosErrorMessage = (error) => {
  const d = error.response?.data;
  if (!d) return error.message || '请求失败，请稍后再试';
  if (typeof d.message === 'string') return d.message;
  if (typeof d.msg === 'string') return d.msg;
  if (typeof d.detail === 'string') return d.detail;
  const det = d.detail;
  if (Array.isArray(det) && det.length) {
    const x = det[0];
    if (typeof x === 'string') return x;
  }
  if (det && typeof det === 'object' && !Array.isArray(det)) {
    const k = Object.keys(det)[0];
    if (k) {
      const v = det[k];
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && v.length) return String(v[0]);
    }
  }
  return '请求失败，请稍后再试';
};

export const useUserStore = defineStore('user', {
  state: () => ({
    userInfo: null,
    token: '',
    refreshToken: '',
    /** access_token 过期时刻（ms），来自登录 data.expires_in；无则 null */
    tokenExpiresAt: null,
    isLogin: false,
    userBio: '这是我的个人简介'
  }),
  
  getters: {
    getUserInfo: (state) => state.userInfo,
    getToken: (state) => state.token,
    getLoginStatus: (state) => state.isLogin,
    getUserBio: (state) => state.userInfo?.bio || state.userBio
  },
  
  actions: {
    async login(userData) {
      try {
        const response = await axios.post(apiConfig.endpoints.login, {
          username: userData.username,
          password: userData.password
        });

        // 这里调用我刚才提供的解析函数
        const { ok, token, refreshToken, userInfo, message, expiresIn } =
          parseUserServiceResponse(response);

        // 检查 token 是否存在
        const cleanToken = normalizeJwtToken(token);
        if (ok && cleanToken) {
          localStorage.setItem('jwt_token', cleanToken);
          const rt = normalizeJwtToken(refreshToken);
          if (rt) {
            localStorage.setItem('jwt_refresh_token', rt);
            this.refreshToken = rt;
          } else {
            localStorage.removeItem('jwt_refresh_token');
            this.refreshToken = '';
          }
          if (typeof expiresIn === 'number' && expiresIn > 0) {
            const at = Date.now() + expiresIn * 1000;
            localStorage.setItem('jwt_expires_at', String(at));
            this.tokenExpiresAt = at;
          }
          this.userInfo = userInfo;
          this.token = cleanToken;
          this.isLogin = true;

          console.log('登录成功，Token已保存');

          return {
            success: true,
            message: '登录成功'
          };
        }

        // 如果走到这里，说明虽然请求成功了，但业务逻辑失败了
        return {
          success: false,
          message: message || '登录失败'
        };
      } catch (error) {
        console.error('登录请求异常:', error);
        return {
          success: false,
          message: error.response?.data?.message || '登录请求失败，请稍后再试'
        };
      }
    },
    
    async logout() {
      try {
        // 发送注销请求
        const token = localStorage.getItem('jwt_token') || this.token;
        const auth = bearerAuthHeaders(token);
        if (Object.keys(auth).length) {
          await axios.post(apiConfig.endpoints.logout, {}, {
            headers: {
              ...auth,
              'X-CSRFTOKEN': getCsrfToken()
            }
          });
        }
      } catch (error) {
        console.error('注销请求失败:', error);
      } finally {
        // 清除本地状态
        this.userInfo = null;
        this.token = '';
        this.refreshToken = '';
        this.tokenExpiresAt = null;
        this.isLogin = false;
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('jwt_refresh_token');
        localStorage.removeItem('jwt_expires_at');
      }
    },
    
    // 获取用户信息
    async getUserInfoDetail() {
      try {
        // 从localStorage获取token
        const token = localStorage.getItem('jwt_token') || this.token;
        const auth = bearerAuthHeaders(token);
        if (!Object.keys(auth).length) {
          return {
            success: false,
            message: '未登录'
          };
        }
        
        // 发送获取用户信息请求
        const response = await axios.get(apiConfig.endpoints.profile, {
          headers: {
            ...auth,
            'X-CSRFTOKEN': getCsrfToken()
          }
        });

        const body = response?.data ?? {};
        const httpOk = response.status === 200;
        const code = body.code;
        const codeOk =
          code === undefined ||
          code === null ||
          code === 0 ||
          code === 200;
        const payload = body.data;

        // 与 BaseResponse 一致：业务成功需 code 合法且 data 有值（避免 HTTP 200 + 业务失败仍 success: true）
        if (httpOk && codeOk && payload != null && typeof payload === 'object') {
          this.userInfo = payload;
          return {
            success: true,
            message: body.message || body.msg || '操作成功',
            data: payload
          };
        }

        return {
          success: false,
          message:
            body.message ||
            body.msg ||
            (typeof body.detail === 'string' ? body.detail : '') ||
            '获取用户信息失败'
        };
      } catch (error) {
        console.error('获取用户信息请求失败:', error);
        return {
          success: false,
          message: extractAxiosErrorMessage(error)
        };
      }
    },
    
    /**
     * 更新用户信息。无文件时 JSON；有头像文件时 multipart，字段名与 UsersUpdateDTO + MultipartFile avatarFile 对齐。
     * @param {Record<string, unknown>} userData
     * @param {{ avatarFile?: File | Blob }} [options]
     */
    async updateUserInfo(userData, options = {}) {
      try {
        // 从localStorage获取token
        const token = localStorage.getItem('jwt_token') || this.token;
        const auth = bearerAuthHeaders(token);
        if (!Object.keys(auth).length) {
          return {
            success: false,
            message: '未登录'
          };
        }

        const avatarFile = options?.avatarFile;
        const dtoKeys = ['username', 'email', 'telephone', 'gender', 'bio', 'avatar'];

        let response;
        if (avatarFile instanceof Blob) {
          const formData = new FormData();
          for (const key of dtoKeys) {
            if (!Object.prototype.hasOwnProperty.call(userData, key)) continue;
            const v = userData[key];
            if (v === undefined || v === null) continue;
            formData.append(key, typeof v === 'number' ? String(v) : String(v));
          }
          const fileName =
            avatarFile instanceof File && avatarFile.name
              ? avatarFile.name
              : 'avatar.jpg';
          formData.append('avatarFile', avatarFile, fileName);

          response = await axios.post(apiConfig.endpoints.updateProfile, formData, {
            headers: {
              ...auth,
              'X-CSRFTOKEN': getCsrfToken()
            }
          });
        } else {
          response = await axios.post(
            apiConfig.endpoints.updateProfile,
            userData,
            {
              headers: {
                ...auth,
                'X-CSRFTOKEN': getCsrfToken(),
                'Content-Type': 'application/json'
              }
            }
          );
        }

        const body = response?.data ?? {};
        const httpOk = response.status === 200;
        const code = body.code;
        const codeOk =
          code === undefined ||
          code === null ||
          code === 0 ||
          code === 200;
        const userPayload = body.data ?? body.user;

        if (httpOk && codeOk) {
          if (userPayload != null && typeof userPayload === 'object') {
            this.userInfo = userPayload;
          } else {
            this.userInfo = { ...(this.userInfo || {}), ...userData };
          }

          if (body.token) {
            const nt = normalizeJwtToken(body.token);
            this.token = nt;
            localStorage.setItem('jwt_token', nt);
          }

          return {
            success: true,
            message: body.message || body.msg || '操作成功'
          };
        }

        return {
          success: false,
          message:
            body.message ||
            body.msg ||
            (typeof body.detail === 'string' ? body.detail : '') ||
            '更新用户信息失败'
        };
      } catch (error) {
        console.error('更新用户信息请求失败:', error);
        console.error('错误响应:', error.response?.data);
        console.error('错误状态:', error.response?.status);
        return {
          success: false,
          message: extractAxiosErrorMessage(error)
        };
      }
    },
    
    // 更新密码（后端：POST reset-pwd，@RequestParam + form-urlencoded）
    async updatePassword(oldPassword, newPassword, confirmPassword) {
      try {
        // 从localStorage获取token
        const token = localStorage.getItem('jwt_token') || this.token;
        const auth = bearerAuthHeaders(token);
        if (!Object.keys(auth).length) {
          return {
            success: false,
            message: '未登录'
          };
        }

        const body = new URLSearchParams();
        body.set('oldPassword', oldPassword);
        body.set('newPassword', newPassword);
        body.set('confirm_password', confirmPassword ?? newPassword);

        const response = await axios.post(apiConfig.endpoints.changePassword, body, {
          headers: {
            ...auth,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        const interpreted = interpretUserWriteResponse(response);
        if (interpreted.success) {
          return {
            success: true,
            message: interpreted.message
          };
        }
        return {
          success: false,
          message: interpreted.message || '更新密码失败'
        };
      } catch (error) {
        console.error('更新密码请求失败:', error);
        return {
          success: false,
          message: extractAxiosErrorMessage(error)
        };
      }
    },
    
    // 用户注册
    async register(userData) {
      try {
        console.log('=== 开始注册请求 ===');
        console.log('请求数据:', userData);

        // 发送注册请求到用户服务
        const response = await axios.post(apiConfig.endpoints.register, {
          username: userData.username,
          email: userData.email,
          telephone: userData.telephone || '',
          password: userData.password,
          confirm_password: userData.confirm_password
        }, {
          headers: {
            'X-CSRFTOKEN': getCsrfToken(),
            'Content-Type': 'application/json'
          }
        });

        console.log('=== 注册响应 ===');
        console.log('响应状态码:', response.status);
        console.log('响应数据:', response.data);

        const { ok, token, refreshToken, userInfo, message, expiresIn } =
          parseUserServiceResponse(response);
        const cleanToken = normalizeJwtToken(token);
        if (ok && cleanToken) {
          localStorage.setItem('jwt_token', cleanToken);
          const rt = normalizeJwtToken(refreshToken);
          if (rt) {
            localStorage.setItem('jwt_refresh_token', rt);
            this.refreshToken = rt;
          } else {
            localStorage.removeItem('jwt_refresh_token');
            this.refreshToken = '';
          }
          if (typeof expiresIn === 'number' && expiresIn > 0) {
            const at = Date.now() + expiresIn * 1000;
            localStorage.setItem('jwt_expires_at', String(at));
            this.tokenExpiresAt = at;
          }
          this.userInfo = userInfo ?? null;
          this.token = cleanToken;
          this.isLogin = true;
          console.log('注册成功，已保存用户信息和token');
          return {
            success: true,
            message: message || '注册成功'
          };
        }
        console.log('注册失败:', message || '未知错误');
        return {
          success: false,
          message: message || '注册失败'
        };
      } catch (error) {
        console.error('=== 注册请求异常 ===');
        console.error('错误:', error);

        const d = error.response?.data;
        let errorMessage = '注册失败，请稍后重试';
        if (d?.message) errorMessage = d.message;
        else if (d?.msg) errorMessage = d.msg;
        else if (typeof d?.detail === 'string') errorMessage = d.detail;

        return {
          success: false,
          message: errorMessage
        };
      }
    }
  },
  
  // 添加持久化配置
  persist: {
    enabled: true,
    strategies: [
      {
        key: 'user-store',
        storage: localStorage
      }
    ]
  }
});