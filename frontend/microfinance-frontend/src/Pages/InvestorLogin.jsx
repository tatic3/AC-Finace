// src/Pages/InvestorLogin.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { Loader2, Mail, Lock } from 'lucide-react';
import PublicNavbar from '../Pages/PublicNavbar';
import { useAuth } from '../hooks/AuthContext.jsx';
import api from '../api/axios';
import './InvestorLogin.css';

export default function InvestorLogin() {
  const navigate = useNavigate();
  const { accessToken, setAccessToken, logout } = useAuth();

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
      <div className="investor-login-page">
        <div className="investor-login-card">
          <h2 className="text-3xl font-bold mb-6 text-center text-white">Investor Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label htmlFor="emailOrUsername">Email or Username</label>
              <div className="input-wrapper">
                <Mail className="icon" />
                <input
                  type="text"
                  id="emailOrUsername"
                  name="emailOrUsername"
                  placeholder="Email or Username"
                  required
                  disabled={loading}
                  value={form.emailOrUsername}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock className="icon" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  value={form.password}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="text-right form-group">
              <Link to="/investor/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </div>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading && <Loader2 className="loader-icon" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-white">
            Need an account?{' '}
            <Link to="/investor/register" className="register-link">
              Register
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}