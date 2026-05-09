import { api } from './config';

export const resourcesApi = {
  getList: async (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = queryParams ? `/api/resources?${queryParams}` : '/api/resources';
    return api.get(endpoint);
  },

  getDetail: async (resourceId) => {
    return api.get(`/api/resources/${resourceId}`);
  },

  search: async (keyword) => {
    return api.get(`/api/resources/search?keyword=${encodeURIComponent(keyword)}`);
  },

  toggleFavorite: async (resourceId) => {
    return api.post(`/api/resources/${resourceId}/favorite`);
  },

  getFavorites: async () => {
    return api.get('/api/resources/favorites');
  },
};

export default resourcesApi;
