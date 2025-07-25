// src/Pages/AdminLogin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext.jsx';
import './AdminLogin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { accessToken, setAccessToken } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accessToken) navigate('/admin/dashboard', { replace: true });
  }, [accessToken, navigate]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        email: form.email,
        password: form.password,
      });
      const token = data.access_token;
      if (!token) throw new Error('Login failed: no token returned');
      setAccessToken(token);
      toast.success('Logged in successfully');
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.msg || err.message || 'Login failed';
      toast.error(msg);
      setForm(prev => ({ ...prev, password: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h2 className="text-3xl font-bold mb-6 text-center text-white">
          Admin Login
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={loading}
              value={form.email}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              disabled={loading}
              value={form.password}
              onChange={handleChange}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2 h-5 w-5 text-[#5fb5ca]" /> : null}
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
