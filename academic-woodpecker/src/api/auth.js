import { api, setAuthToken, clearAuthToken } from './config';

export const authApi = {
  register: async (userData) => {
    const response = await api.post('/api/auth/register', {
      username: userData.username,
      password: userData.password,
      nickname: userData.nickname,
      email: userData.email || ''
    });
    if (response?.data?.token) {
      setAuthToken(response.data.token);
    }
    return response;
  },

  login: async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    if (response?.data?.token) {
      setAuthToken(response.data.token);
    }
    return response;
  },

  logout: () => {
    clearAuthToken();
  },

  getCurrentUser: async () => {
    return api.get('/api/auth/current-user');
  },
};

export default authApi;
