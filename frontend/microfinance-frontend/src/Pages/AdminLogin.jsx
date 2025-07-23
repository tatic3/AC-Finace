// src/Pages/AdminLogin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext.jsx';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { accessToken, setAccessToken } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // If we're already logged in, send them to dashboard
  useEffect(() => {
    if (accessToken) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [accessToken, navigate]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      // call our unified auth endpoint
      const { data } = await api.post('/auth/login', {
        // your backend reads either 'email' or 'email_or_username'
        email: form.email,
        password: form.password
      });

      // pull out the access token from the JSON response
      const token = data.access_token;
      if (!token) {
        throw new Error('Login failed: no token returned');
      }

      // stash it in your React context (and localStorage)
      setAccessToken(token);

      toast.success('Logged in successfully');
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      // pick the right error message
      const msg =
        err.response?.data?.msg ||
        err.response?.data?.error ||
        err.message ||
        'Login failed';
      toast.error(msg);
      // clear the password for safety
      setForm(prev => ({ ...prev, password: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="animate-spin mr-2 h-5 w-5" />}
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
