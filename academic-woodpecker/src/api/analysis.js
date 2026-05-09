import { api } from './config';

export const analysisApi = {
  uploadFile: async (file, fileType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    const { api: apiConfig } = await import('./config');
    return apiConfig.postFormData('/api/analysis/upload', formData);
  },

  getProgress: async (fileId) => {
    return api.get(`/api/analysis/progress/${fileId}`);
  },

  getResult: async (fileId) => {
    return api.get(`/api/analysis/result/${fileId}`);
  },

  updateResult: async (fileId, data) => {
    return api.put(`/api/analysis/result/${fileId}`, data);
  },

  getHistory: async (page = 1, pageSize = 10) => {
    return api.get(`/api/analysis/history?page=${page}&pageSize=${pageSize}`);
  },

  deleteDocument: async (documentId) => {
    return api.delete(`/api/analysis/document/${documentId}`);
  },

  updateDocument: async (documentId, data) => {
    return api.put(`/api/analysis/document/${documentId}`, data);
  },

  toggleDocumentFavorite: async (documentId) => {
    return api.post(`/api/analysis/document/${documentId}/favorite`);
  },

  getFavoriteDocuments: async () => {
    return api.get('/api/analysis/documents/favorites');
  },

  batchDeleteDocuments: async (docIds) => {
    return api.delete('/api/analysis/documents/batch', { docIds });
  },
};

export default analysisApi;