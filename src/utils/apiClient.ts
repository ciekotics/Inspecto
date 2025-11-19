import axios from 'axios';
import {store} from '../store/store';

export const client = axios.create({
  baseURL: 'https://api.marnix.in',
  timeout: 15000,
});

// Attach token if present
client.interceptors.request.use(config => {
  const token = store.getState().auth.token;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
   console.log('[API] Request', {
     method: (config.method || 'get').toUpperCase(),
     url: `${config.baseURL || ''}${config.url || ''}`,
     hasToken: !!token,
   });
  return config;
});

// Optionally handle 401 globally
client.interceptors.response.use(
  r => r,
  err => {
    console.error('[API] Response error', {
      message: err?.message,
      status: err?.response?.status,
      url: err?.config?.url,
      data: err?.response?.data,
    });
    // We could dispatch logout on 401 if desired
    return Promise.reject(err);
  },
);
