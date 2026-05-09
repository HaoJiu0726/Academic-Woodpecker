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

  addGoal: async (title, estimatedMinutes = 30) => {
    return api.post('/api/today/goals', { title, estimatedMinutes });
  },

  editGoal: async (goalId, title, estimatedMinutes) => {
    const data = {};
    if (title !== undefined) data.title = title;
    if (estimatedMinutes !== undefined) data.estimatedMinutes = estimatedMinutes;
    return api.patch(`/api/today/goals/${goalId}`, data);
  },

  deleteGoal: async (goalId) => {
    return api.delete(`/api/today/goals/${goalId}`);
  },

  startStudy: async () => {
    return api.post('/api/today/start-study');
  },

  getPushHistory: async (limit = 7) => {
    return api.get(`/api/today/push-history?limit=${limit}`);
  },
};

export default todayApi;
