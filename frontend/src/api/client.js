import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vv_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

export const recordsAPI = {
  getAll: (params) => api.get('/records', { params }),
  getOne: (id) => api.get(`/records/${id}`),
  create: (formData) => api.post('/records', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const ratingsAPI = {
  submit: (data) => api.post('/ratings', data),
  getForRecord: (recordId) => api.get(`/ratings/record/${recordId}`),
  getForUser: (userId) => api.get(`/ratings/user/${userId}`),
};

export const purchasesAPI = {
  buy: (data) => api.post('/purchases', data),
  getMyPurchases: () => api.get('/purchases/me'),
};

export const agentAPI = {
  chat: (message, threadId) => api.post('/agent/chat', { message, threadId }),
};

export default api;
