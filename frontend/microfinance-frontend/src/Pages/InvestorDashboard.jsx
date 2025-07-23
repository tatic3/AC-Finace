// src/Pages/InvestorDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const { accessToken, logout } = useAuth();
  useRequireAuth('/investor/login');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accessToken) {
      navigate('/investor/login', { replace: true });
      return;
    }
    setLoading(true);
    api.get('/investor/dashboard', { withCredentials: true })
      .then(res => {
        setData(res.data);
        setError(null);
      })
      .catch(err => {
        console.error('Dashboard load error', err);
        if (err.response?.status === 401) {
          toast.error('Session expired. Please log in again.');
          logout();
          navigate('/investor/login', { replace: true });
        } else {
          toast.error('Failed to load dashboard.');
          setError('Failed to load dashboard.');
        }
      })
      .finally(() => setLoading(false));
  }, [accessToken, navigate, logout]);

  if (loading) return (
    <div className="flex justify-center items-center h-full py-20">
      <Loader2 className="animate-spin text-gray-500" size={32} />
    </div>
  );

  if (error) return <div className="text-red-600 text-center mt-16">{error}</div>;

  const {
    investment_summary,
    loan_summary,
    repayment_summary,
    withdrawal_status
  } = data;

  // Destructure loan_summary with defaults
  const {
    total_repayable = 0,
    active_loans = 0
  } = loan_summary;

  // Prepare data for charts
  const pieData = [
    { name: 'Invested', value: investment_summary.total_invested },
    { name: 'Returns', value: investment_summary.total_returns }
  ];
  const barData = [
    { name: 'Repaid', amount: repayment_summary.total_repaid },
    { name: 'Repayable', amount: total_repayable }
  ];
  const lineData = [
    { name: 'Active Loans', value: active_loans },
    { name: 'Pending Withdrawals', value: withdrawal_status.pending_requests }
  ];

  return (
    <div className="pt-20 px-4 max-w-5xl mx-auto space-y-8">
      <h1 className="text-4xl font-extrabold text-gray-900">Investor Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Invested" value={`$${investment_summary.total_invested}`} />
        <StatCard title="Expected Returns" value={`$${investment_summary.total_returns}`} />
        <StatCard title="Total Loan Repayable" value={`$${total_repayable}`} />
        <StatCard title="Total Repaid" value={`$${repayment_summary.total_repaid}`} />
        <StatCard title="Active Loans" value={active_loans} />
        <StatCard title="Pending Withdrawals" value={withdrawal_status.pending_requests} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Investment Breakdown</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={5}
                label
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} />
                ))}
              </Pie>
              <Tooltip formatter={val => `$${val.toLocaleString()}`} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Loan Repayments</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={val => `$${val.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="amount" barSize={40} radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Activity Overview</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={lineData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white shadow rounded-2xl p-5 hover:shadow-xl transition">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</h3>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
