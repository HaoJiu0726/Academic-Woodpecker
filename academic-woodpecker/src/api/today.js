import { api } from './config';

export const todayApi = {
  getPush: async () => {
    return api.get('/api/today/push');
  },

  getRecommendations: async () => {
    return api.get('/api/today/recommendations');
  },

  getProgress: async () => {
    return api.get('/api/today/progress');
  },

  getGoals: async () => {
    return api.get('/api/today/goals');
  },

  updateGoal: async (goalId) => {
    return api.put(`/api/today/goals/${goalId}`);
  },

  startStudy: async () => {
    return api.post('/api/today/start-study');
  },
};

export default todayApi;