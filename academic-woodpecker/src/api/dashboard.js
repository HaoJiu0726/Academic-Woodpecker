import { api } from './config';

export const dashboardApi = {
  getOverview: async () => {
    return api.get('/api/dashboard/overview');
  },

  getKnowledgeGraph: async (status) => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    return api.get(`/api/dashboard/knowledge-graph?${query.toString()}`);
  },

  getKnowledgeDetail: async (knowledgeId) => {
    return api.get(`/api/dashboard/knowledge/${knowledgeId}`);
  },

  getRecommendations: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.exclude) query.append('exclude', params.exclude);
    return api.get(`/api/recommendations?${query.toString()}`);
  },

  recordResourceView: async (resourceId) => {
    return api.post(`/api/recommendations/${resourceId}/view`);
  },
};

export default dashboardApi;
