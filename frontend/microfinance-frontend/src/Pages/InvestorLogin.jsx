// src/Pages/InvestorLogin.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { Loader2, Mail, Lock } from 'lucide-react';
import PublicNavbar from '../Pages/PublicNavbar';
import { useAuth } from '../hooks/AuthContext.jsx';
import api from '../api/axios';

export default function InvestorLogin() {
  const navigate = useNavigate();
  const { accessToken, setAccessToken, logout } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (accessToken) {
      navigate('/investor/dashboard', { replace: true });
    }
  }, [accessToken, navigate]);

  const [form, setForm] = useState({ emailOrUsername: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const fireLogin = useCallback(
    debounce(async ({ emailOrUsername, password }) => {
      try {
        const { data } = await api.post('/auth/login', {
          email_or_username: emailOrUsername.trim(),
          password
        });
        const token = data.access_token;
        if (!token) throw new Error('Invalid credentials');

        setAccessToken(token);
        toast.success('Login successful!');
        navigate('/investor/dashboard', { replace: true });
      } catch (err) {
        console.error('Login error', err);
        if (err.response?.status === 401) {
          toast.error(err.response.data.msg || 'Unauthorized');
          logout();
        } else {
          toast.error(err.response?.data?.msg || err.message || 'Login failed');
        }
      } finally {
        setLoading(false);
      }
    }, 300),
    [setAccessToken, navigate, logout]
  );

  const handleSubmit = e => {
    e.preventDefault();
    setLoading(true);
    fireLogin(form);
  };

  return (
    <>
      <PublicNavbar />
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-semibold text-center mb-6">Investor Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center border rounded px-3 py-2">
                <Mail className="mr-2" />
                <input
                  type="text"
                  name="emailOrUsername"
                  value={form.emailOrUsername}
                  onChange={handleChange}
                  placeholder="Email or Username"
                  required
                  className="w-full focus:outline-none"
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center border rounded px-3 py-2">
                <Lock className="mr-2" />
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full focus:outline-none"
                  disabled={loading}
                />
              </div>
            </div>
            {/* Forgot Password Link */}
            <div className="text-right">
              <Link to="/investor/forgot-password" className="text-sm text-indigo-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
            >
              {loading && <Loader2 className="animate-spin mr-2 h-5 w-5" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            Need an account?{' '}
            <Link to="/investor/register" className="text-indigo-600 hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
