import axios from 'axios';
import { apiConfig } from '../config/api';
import { bearerAuthHeaders } from '../utils/authToken';

function pick_reply_from_message_send_vo(vo) {
  if (vo == null) return '';
  if (typeof vo === 'string') return vo;
  if (typeof vo !== 'object') return '';
  return String(
    vo.reply ??
      vo.answer ??
      vo.content ??
      vo.message ??
      vo.response ??
      vo.assistantMessage ??
      vo.aiMessage ??
      vo.output ??
      vo.text ??
      ''
  );
}

function pick_session_id_from_message_send_vo(vo) {
  if (!vo || typeof vo !== 'object') return '';
  return String(vo.session_id ?? vo.sessionId ?? '').trim();
}

/**
 * POST /api/message/send
 * @returns {{ success: true, reply: string, session_id: string } | { success: false, message: string }}
 */
export async function postMessageSend(session_id, text) {
  try {
    const token = localStorage.getItem('jwt_token');
    const res = await axios.post(
      apiConfig.endpoints.messageSend,
      {
        session_id: session_id || undefined,
        sessionId: session_id || undefined,
        query: text,
        content: text,
        message: text
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...bearerAuthHeaders(token)
        }
      }
    );

    const vo = res.data?.data ?? res.data;
    const reply = pick_reply_from_message_send_vo(vo);
    const sid = pick_session_id_from_message_send_vo(vo) || session_id || '';

    return {
      success: true,
      reply,
      session_id: sid || session_id
    };
  } catch (error) {
    return {
      success: false,
      message:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        '发送消息失败'
    };
  }
}

/** GET /api/message/list/{session_id} → 原始消息数组 */
export async function getMessageListRaw(session_id) {
  const token = localStorage.getItem('jwt_token');
  const res = await axios.get(
    `${apiConfig.endpoints.messageList}${encodeURIComponent(session_id)}`,
    {
      headers: {
        ...bearerAuthHeaders(token)
      }
    }
  );
  const list = res.data?.data ?? res.data;
  return Array.isArray(list) ? list : [];
}
