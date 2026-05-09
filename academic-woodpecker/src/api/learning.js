import { api } from './config';

export const learningApi = {
  createRecord: async (data) => {
    return api.post('/api/learning/records', data);
  },

  getRecords: async (page = 1, pageSize = 10) => {
    return api.get(`/api/learning/records?page=${page}&page_size=${pageSize}`);
  },

  getStats: async () => {
    return api.get('/api/learning/stats');
  },
};

export default learningApi;
