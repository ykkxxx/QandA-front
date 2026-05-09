import { defineStore } from 'pinia';
import axios from 'axios';
import { apiConfig } from '../config/api';

// 从cookie中获取CSRF token
const getCsrfToken = () => {
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  return cookieValue || '';
};

/** 用户服务统一响应：成功为 code === 0，负载多在 data 内 */
const parseUserServiceResponse = (response) => {
  const body = response?.data ?? {};
  const ok = body.code === 0;
  const payload = body.data !== undefined ? body.data : body;
  const token = payload?.token ?? payload?.access_token ?? body.token;
  const userInfo = payload?.user ?? payload?.user_info ?? body.user;
  const message = body.message ?? body.msg ?? payload?.message;
  return { ok, body, payload, token, userInfo, message };
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
    if (body.code !== 0) {
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
        // 发送登录请求
        const response = await axios.post(apiConfig.endpoints.login, {
          username: userData.username,
          password: userData.password
        });
        console.log('response', response);
        const { ok, token, userInfo, message } = parseUserServiceResponse(response);
        if (ok && token) {
          localStorage.setItem('jwt_token', token);
          this.userInfo = userInfo ?? null;
          this.token = token;
          this.isLogin = true;
          return {
            success: true,
            message: message || '登录成功'
          };
        }
        return {
          success: false,
          message: message || response.data?.detail || '登录失败'
        };
      } catch (error) {
        console.error('登录请求失败:', error);
        const d = error.response?.data;
        return {
          success: false,
          message:
            d?.message ||
            d?.msg ||
            d?.detail?.non_field_errors?.[0] ||
            (typeof d?.detail === 'string' ? d.detail : null) ||
            '登录请求失败，请稍后再试'
        };
      }
    },
    
    async logout() {
      try {
        // 发送注销请求
        const token = localStorage.getItem('jwt_token') || this.token;
        if (token) {
          await axios.post(apiConfig.endpoints.logout, {}, {
            headers: {
              Authorization: `Bearer ${token}`,
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
        this.isLogin = false;
        // 从localStorage中清除token
        localStorage.removeItem('jwt_token');
      }
    },
    
    // 获取用户信息
    async getUserInfoDetail() {
      try {
        // 从localStorage获取token
        const token = localStorage.getItem('jwt_token') || this.token;
        // 检查是否有token
        if (!token) {
          return {
            success: false,
            message: '未登录'
          };
        }
        
        // 发送获取用户信息请求
        const response = await axios.get(apiConfig.endpoints.profile, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-CSRFTOKEN': getCsrfToken()
          }
        });
        
        // 检查响应状态
        if (response.status === 200) {
          // 更新用户信息
          this.userInfo = response.data.data;
          
          return {
            success: true,
            message: response.data.message,
            data: response.data.data
          };
        } else {
          return {
            success: false,
            message: response.data.detail || '获取用户信息失败'
          };
        }
      } catch (error) {
        console.error('获取用户信息请求失败:', error);
        return {
          success: false,
          message: error.response?.data?.detail || '获取用户信息请求失败，请稍后再试'
        };
      }
    },
    
    // 更新用户信息
    async updateUserInfo(userData) {
      try {
        // 从localStorage获取token
        const token = localStorage.getItem('jwt_token') || this.token;
        // 检查是否有token
        if (!token) {
          return {
            success: false,
            message: '未登录'
          };
        }
        
        // 发送更新用户信息请求
        console.log('更新用户信息请求参数:', userData);
        const response = await axios.put(apiConfig.endpoints.updateProfile, userData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-CSRFTOKEN': getCsrfToken(),
            'Content-Type': 'application/json'
          }
        });
        
        // 检查响应状态
        if (response.status === 200) {
          // 更新用户信息
          this.userInfo = response.data.user;
          
          // 如果返回了新的token，更新token
          if (response.data.token) {
            this.token = response.data.token;
            localStorage.setItem('jwt_token', response.data.token);
          }
          
          return {
            success: true,
            message: response.data.message
          };
        } else {
          return {
            success: false,
            message: response.data.detail || '更新用户信息失败'
          };
        }
      } catch (error) {
        console.error('更新用户信息请求失败:', error);
        console.error('错误响应:', error.response?.data);
        console.error('错误状态:', error.response?.status);
        return {
          success: false,
          message: error.response?.data?.message || error.response?.data?.detail || '更新用户信息请求失败，请稍后再试'
        };
      }
    },
    
    // 更新密码（后端：POST reset-pwd，@RequestParam + form-urlencoded）
    async updatePassword(oldPassword, newPassword, confirmPassword) {
      try {
        // 从localStorage获取token
        const token = localStorage.getItem('jwt_token') || this.token;
        // 检查是否有token
        if (!token) {
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
            Authorization: `Bearer ${token}`,
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

        const { ok, token, userInfo, message } = parseUserServiceResponse(response);
        if (ok && token) {
          localStorage.setItem('jwt_token', token);
          this.userInfo = userInfo ?? null;
          this.token = token;
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