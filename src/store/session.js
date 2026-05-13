import { defineStore } from 'pinia';
import axios from 'axios';
import { apiConfig } from '../config/api';
import { bearerAuthHeaders } from '../utils/authToken';
import { postMessageSend, getMessageListRaw } from '../api/chatMessages';

/** 从 POST 创建会话的响应里取出 session_id（兼容 BaseResponse.data 与仅返回 id） */
function pick_session_id_from_create_response(res) {
  const body = res?.data;
  if (!body || typeof body !== 'object') return '';
  const inner = body.data ?? body.result ?? body;
  if (typeof inner === 'string' || typeof inner === 'number') {
    const s = String(inner).trim();
    return s && s !== 'null' && s !== 'undefined' ? s : '';
  }
  if (!inner || typeof inner !== 'object') return '';
  const keys = ['session_id', 'sessionId', 'id'];
  for (const k of keys) {
    const v = inner[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  if (inner.session && typeof inner.session === 'object') {
    for (const k of keys) {
      const v = inner.session[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return '';
}

/** BaseResponse.data 为 List<ChatSessionVO> 或 { sessions: [] } */
function extractSessionsArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.sessions)) return data.sessions;
  if (data && Array.isArray(data.records)) return data.records;
  return [];
}

/** ChatSessionVO：统一读出 session_id（后端可能仍序列化为 sessionId） */
function mapListItem(session) {
  const session_id = session.session_id ?? session.sessionId ?? session.id ?? '';
  return {
    session_id,
    title: session.title,
    created_at: session.createdAt ?? session.created_at,
    updated_at: session.updatedAt ?? session.updated_at
  };
}

/** BaseResponse 或外层 VO 再包一层 data 时，剥出真正的会话历史对象 */
function unwrap_session_payload(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const hasHistory =
    raw.history != null ||
    raw.histories != null ||
    raw.messages != null ||
    raw.messageList != null ||
    raw.chatHistory != null ||
    raw.records != null ||
    raw.conversation != null;
  const hasId = raw.session_id != null || raw.sessionId != null || raw.id != null;
  if (raw.data && typeof raw.data === 'object' && !hasHistory && !hasId) {
    const d = raw.data;
    if (
      d.history != null ||
      d.histories != null ||
      d.messages != null ||
      d.messageList != null ||
      d.chatHistory != null ||
      d.session_id != null ||
      d.sessionId != null ||
      d.id != null
    ) {
      return d;
    }
  }
  return raw;
}

/**
 * 选择用于解析的历史/消息数组：优先 ChatSessionHistoryVO.messageList；
 * 跳过「存在但为空」的数组，避免 history:[] 挡住 messageList。
 */
function pick_message_or_history_array(base) {
  const keys = [
    'messageList',
    'history',
    'histories',
    'chatHistory',
    'records',
    'recordList',
    'turns',
    'messagesList',
    'conversation',
    'messages'
  ];
  let emptyFallback = undefined;
  for (const k of keys) {
    const v = base[k];
    if (!Array.isArray(v)) continue;
    if (v.length > 0) return v;
    if (emptyFallback === undefined) emptyFallback = v;
  }
  return emptyFallback;
}

/**
 * 将后端 ChatSessionHistoryVO 规范为前端 AIChat 使用的
 * { session_id, history: [[user, ai], ...] }
 * 对齐 ChatSessionHistoryVO：sessionId、messageList(List<ChatMessageVO>)；
 * 仍兼容 snake_case 与其它历史字段名。
 */
function normalizeChatHistoryVo(raw, fallback_session_id) {
  const base = raw && typeof raw === 'object' ? { ...raw } : {};
  const session_id =
    base.session_id ??
    base.sessionId ??
    base.id ??
    fallback_session_id ??
    '';
  base.session_id = session_id;

  let history = [];
  const h = pick_message_or_history_array(base);

  if (Array.isArray(h) && h.length) {
    const first = h[0];
    if (Array.isArray(first) && first.length >= 2) {
      history = h.map((pair) => [String(pair[0] ?? ''), String(pair[1] ?? '')]);
    } else if (
      typeof first === 'object' &&
      first !== null &&
      (first.role != null ||
        first.sender != null ||
        first.senderType != null ||
        first.messageType != null ||
        first.type != null)
    ) {
      const pairs = [];
      let userBuf = '';
      for (const m of h) {
        const role = String(
          m.role ?? m.sender ?? m.senderType ?? m.messageType ?? m.type ?? ''
        ).toLowerCase();
        const content = String(
          m.content ?? m.text ?? m.messageContent ?? m.body ?? m.message ?? m.msg ?? ''
        );
        if (role === 'user' || role === 'human' || role === 'customer' || role === 'client') {
          if (userBuf) pairs.push([userBuf, '']);
          userBuf = content;
        } else if (
          role === 'assistant' ||
          role === 'ai' ||
          role === 'bot' ||
          role === 'system' ||
          role === 'model'
        ) {
          if (userBuf) {
            pairs.push([userBuf, content]);
            userBuf = '';
          } else {
            pairs.push(['', content]);
          }
        }
      }
      if (userBuf) pairs.push([userBuf, '']);
      history = pairs;
    } else if (typeof first === 'object' && first !== null) {
      history = h.map((row) => {
        if (Array.isArray(row) && row.length >= 2) {
          return [String(row[0] ?? ''), String(row[1] ?? '')];
        }
        return [
          String(
            row.userMessage ??
              row.userContent ??
              row.user_query ??
              row.userQuestion ??
              row.query ??
              row.question ??
              row.questionText ??
              row.user ??
              row.userMsg ??
              row.prompt ??
              row.input ??
              row.userText ??
              ''
          ),
          String(
            row.aiMessage ??
              row.aiContent ??
              row.ai_answer ??
              row.aiAnswer ??
              row.answer ??
              row.reply ??
              row.assistant ??
              row.assistantMsg ??
              row.completion ??
              row.output ??
              row.answerText ??
              row.bot ??
              ''
          )
        ];
      });
    }
  }

  if (!history.length && Array.isArray(base.messages)) {
    const pairs = [];
    let userBuf = '';
    for (const m of base.messages) {
      const role = String(m.role ?? m.sender ?? '').toLowerCase();
      const content = String(m.content ?? m.text ?? '');
      if (role === 'user' || role === 'human') {
        if (userBuf) pairs.push([userBuf, '']);
        userBuf = content;
      } else if (role === 'assistant' || role === 'ai' || role === 'bot') {
        if (userBuf) {
          pairs.push([userBuf, content]);
          userBuf = '';
        } else {
          pairs.push(['', content]);
        }
      }
    }
    if (userBuf) pairs.push([userBuf, '']);
    history = pairs;
  }

  base.history = history;
  return base;
}

/** List<ChatMessages>（GET /api/message/list/{session_id}）→ { session_id, history } */
function normalize_chat_messages_list(list, fallback_session_id) {
  if (!Array.isArray(list) || list.length === 0) {
    return { session_id: fallback_session_id || '', history: [] };
  }
  const first = list[0];
  const session_id =
    (first && (first.session_id ?? first.sessionId)) ?? fallback_session_id ?? '';

  const hasRole =
    first &&
    typeof first === 'object' &&
    (first.role != null ||
      first.sender != null ||
      first.senderType != null ||
      first.messageType != null ||
      first.type != null);

  if (hasRole) {
    const pairs = [];
    let userBuf = '';
    for (const m of list) {
      const role = String(
        m.role ?? m.sender ?? m.senderType ?? m.messageType ?? m.type ?? ''
      ).toLowerCase();
      const content = String(
        m.content ?? m.text ?? m.messageContent ?? m.body ?? m.message ?? m.msg ?? ''
      );
      if (role === 'user' || role === 'human' || role === 'customer' || role === 'client') {
        if (userBuf) pairs.push([userBuf, '']);
        userBuf = content;
      } else if (
        role === 'assistant' ||
        role === 'ai' ||
        role === 'bot' ||
        role === 'system' ||
        role === 'model'
      ) {
        if (userBuf) {
          pairs.push([userBuf, content]);
          userBuf = '';
        } else {
          pairs.push(['', content]);
        }
      }
    }
    if (userBuf) pairs.push([userBuf, '']);
    if (pairs.some((p) => p[0] || p[1])) {
      return { session_id: session_id || fallback_session_id || '', history: pairs };
    }
  }

  const history = list.map((row) => [
    String(
      row.query ??
        row.question ??
        row.userMessage ??
        row.userContent ??
        row.prompt ??
        row.input ??
        ''
    ),
    String(
      row.answer ??
        row.reply ??
        row.assistantMessage ??
        row.aiMessage ??
        row.completion ??
        row.output ??
        row.content ??
        ''
    )
  ]);
  return { session_id: session_id || fallback_session_id || '', history };
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    sessions: [],
    currentSession: null,
    loading: false
  }),

  getters: {
    getSessions: (state) => state.sessions,
    getCurrentSession: (state) => state.currentSession,
    isLoading: (state) => state.loading
  },

  actions: {
    /**
     * 当前登录用户的会话列表（后端从 token 取用户，无需路径上的 userId）
     * @param {string} [_userId] 兼容旧调用，已忽略
     */
    async getUserSessions(_userId) {
      try {
        this.loading = true;
        const token = localStorage.getItem('jwt_token');
        const response = await axios.get(apiConfig.endpoints.getUserSessions, {
          headers: {
            ...bearerAuthHeaders(token)
          }
        });

        const payload = response.data?.data ?? response.data;
        const sessionsData = extractSessionsArray(payload);

        this.sessions = sessionsData.map(mapListItem).filter((s) => s.session_id);

        this.sessions.sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at);
          const dateB = new Date(b.updated_at || b.created_at);
          return dateB - dateA;
        });

        return {
          success: true,
          data: this.sessions
        };
      } catch (error) {
        console.error('获取用户会话失败:', error);
        return {
          success: false,
          message:
            error.response?.data?.detail ||
            error.response?.data?.message ||
            error.message ||
            '获取会话失败'
        };
      } finally {
        this.loading = false;
      }
    },

    async getSession(session_id) {
      try {
        this.loading = true;
        const token = localStorage.getItem('jwt_token');
        const response = await axios.get(`${apiConfig.endpoints.getSession}${session_id}`, {
          headers: {
            ...bearerAuthHeaders(token)
          }
        });

        const raw = unwrap_session_payload(response.data?.data ?? response.data);
        const sessionData = normalizeChatHistoryVo(raw, session_id);
        this.currentSession = sessionData;
        return {
          success: true,
          data: sessionData
        };
      } catch (error) {
        console.error('获取会话详情失败:', error);
        return {
          success: false,
          message:
            error.response?.data?.detail ||
            error.response?.data?.message ||
            '获取会话详情失败'
        };
      } finally {
        this.loading = false;
      }
    },

    async getMessageList(session_id) {
      try {
        this.loading = true;
        const arr = await getMessageListRaw(session_id);
        const sessionData = normalize_chat_messages_list(arr, session_id);
        this.currentSession = sessionData;
        return {
          success: true,
          data: sessionData
        };
      } catch (error) {
        console.error('获取消息列表失败:', error);
        return {
          success: false,
          message:
            error.response?.data?.detail ||
            error.response?.data?.message ||
            '获取消息列表失败'
        };
      } finally {
        this.loading = false;
      }
    },

    /**
     * POST /api/message/send（实现见 src/api/chatMessages.js）
     */
    sendChatMessage(session_id, text) {
      return postMessageSend(session_id, text);
    },

    async deleteSession(session_id) {
      try {
        this.loading = true;
        const token = localStorage.getItem('jwt_token');
        await axios.delete(`${apiConfig.endpoints.deleteSession}${session_id}`, {
          headers: {
            ...bearerAuthHeaders(token)
          }
        });

        if (Array.isArray(this.sessions)) {
          this.sessions = this.sessions.filter((session) => session.session_id !== session_id);
        } else {
          this.sessions = [];
        }

        if (this.currentSession && this.currentSession.session_id === session_id) {
          this.currentSession = null;
        }

        return {
          success: true,
          message: '会话删除成功'
        };
      } catch (error) {
        console.error('删除会话失败:', error);
        return {
          success: false,
          message:
            error.response?.data?.detail ||
            error.response?.data?.message ||
            '删除会话失败'
        };
      } finally {
        this.loading = false;
      }
    },

    /**
     * 先 POST /api/session 创建会话，再通过 /api/message/send 发送首条消息
     */
    async createSession(query) {
      try {
        this.loading = true;

        const createUrl = apiConfig.endpoints.createSession;
        let createRes;
        try {
          createRes = await axios.post(createUrl, {}, {
            headers: {
              ...bearerAuthHeaders(localStorage.getItem('jwt_token'))
            }
          });
        } catch (e) {
          const st = e.response?.status;
          const detail =
            e.response?.data?.detail ||
            e.response?.data?.message ||
            e.response?.data?.msg ||
            e.message;
          throw new Error(`创建会话 POST 失败${st ? ` ${st}` : ''}: ${detail}（${createUrl}）`);
        }

        const created_session_id = pick_session_id_from_create_response(createRes);
        if (!created_session_id) {
          const snippet = createRes?.data != null ? JSON.stringify(createRes.data).slice(0, 280) : '';
          throw new Error(
            `创建会话失败：响应中无 session_id。请核对 BaseResponse.data 内字段。响应片段: ${snippet}`
          );
        }

        const sendResult = await this.sendChatMessage(created_session_id, query);
        if (!sendResult.success) {
          throw new Error(sendResult.message || '消息发送失败');
        }

        const effective_sid = sendResult.session_id || created_session_id;
        const sessionResponse = await this.getMessageList(effective_sid);
        if (sessionResponse.success && sessionResponse.data) {
          sessionResponse.data.session_id =
            sessionResponse.data.session_id || effective_sid;
          return sessionResponse;
        }

        const minimal = {
          session_id: effective_sid,
          history: []
        };
        this.currentSession = minimal;
        return {
          success: true,
          data: minimal
        };
      } catch (error) {
        console.error('创建会话失败:', error);
        return {
          success: false,
          message: error.message || '创建会话失败'
        };
      } finally {
        this.loading = false;
      }
    },

    setCurrentSession(session) {
      this.currentSession = session;
    },

    clearSessions() {
      this.sessions = [];
      this.currentSession = null;
    }
  }
});
