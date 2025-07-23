// src/api/axios.js
import axios from 'axios';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,    // send cookies on every request
});

// No more localStorage token lookup here—AuthContext is responsible for
// setting the Authorization header if you’re using header-based access tokens.

// Response interceptor to catch 401s and redirect to the appropriate login
api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    if (status === 401) {
      // clear any local auth state if you want:
      // localStorage.removeItem('accessToken');
      // then redirect:
      const { url } = error.config;
      if (url.startsWith('/admin')) {
        history.push('/admin/login');
      } else {
        history.push('/investor/login');
      }
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
