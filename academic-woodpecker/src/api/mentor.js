import { api } from './config';

export const mentorApi = {
  getSuggestedActions: async () => {
    return api.get('/api/mentor/suggested-actions');
  },

  sendMessage: async (message, context = {}, threadId = null) => {
    const endpoint = threadId
      ? `/api/mentor/chat?thread_id=${threadId}`
      : '/api/mentor/chat';
    return api.post(endpoint, { message, context });
  },

  sendStreamMessage: async (message, context = {}, threadId = null) => {
    const endpoint = threadId
      ? `/api/mentor/chat/stream?thread_id=${threadId}`
      : '/api/mentor/chat/stream';
    return api.post(endpoint, { message, context });
  },

  getHistory: async (page = 1, pageSize = 10) => {
    return api.get(`/api/mentor/history?page=${page}&pageSize=${pageSize}`);
  },

  clearHistory: async () => {
    return api.delete('/api/mentor/history');
  },
};

export default mentorApi;
