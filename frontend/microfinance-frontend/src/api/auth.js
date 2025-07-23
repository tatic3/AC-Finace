import api from './index';
export const adminLogin = creds => api.post('/admin/login', creds);
export const investorLogin = creds => api.post('/investor/login', creds);