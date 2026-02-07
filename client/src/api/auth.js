import api from './axios';

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  createGuest: (data) => api.post('/auth/guest', data),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  migrateGuestData: (data) => api.post('/auth/migrate-guest-data', data),
};
