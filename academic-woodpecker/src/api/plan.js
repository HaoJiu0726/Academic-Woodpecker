import { api } from './config';

export const planApi = {
  generate: async (data) => {
    return api.post('/api/plan/generate', data);
  },

  getCurrent: async () => {
    return api.get('/api/plan/current');
  },

  updateProgress: async (planId, data) => {
    return api.put(`/api/plan/${planId}/progress`, data);
  },
};

export default planApi;
