// src/Pages/InvestorForgotPassword.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Loader2, Mail } from 'lucide-react';
import PublicNavbar from '../Pages/PublicNavbar';
import api from '../api/axios';

export default function InvestorForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/investor-request-password-reset', { email });
      toast.success(data.message || 'If registered, a reset link has been sent');
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PublicNavbar />
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-semibold text-center mb-6">Forgot Password</h2>
          {submitted ? (
            <p className="text-center text-green-600">
              If that email is registered, you’ll receive a reset link shortly.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center border rounded px-3 py-2">
                <Mail className="mr-2" />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full focus:outline-none"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
              >
                {loading && <Loader2 className="animate-spin mr-2 h-5 w-5" />}
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            Remembered?{' '}
            <Link to="/investor/login" className="text-indigo-600 hover:underline">
              Return to Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
