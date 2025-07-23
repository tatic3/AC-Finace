import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { Loader2 } from 'lucide-react';
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
  Cell
} from 'recharts';

export default function AdminDashboard() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/dashboard-summary');
      const { overview: ov, chart_data, debug } = response.data;
      setOverview(ov);
      setChartData(chart_data);
      setDebugData(debug);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        toast.error('Session expired. Please log in again.');
        logout();
      } else {
        const msg = err.response?.data?.msg || err.response?.data?.error || err.message;
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (accessToken) {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, [accessToken, fetchDashboard]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!overview) {
    return <p className="text-center text-gray-500">No data available.</p>;
  }

  // Log debug data for inspection
  console.log('Dashboard debug:', debugData);

  const {
    approved_investors = 0,
    approved_funds = 0,
    active_loans = 0,
    pending_loans = 0,
    loan_repayments_amount_due_this_month = 0,
    investment_payouts_amount_due_this_month = 0
  } = overview;

  const stats = [
    { label: 'Active Investors', value: approved_investors },
    { label: 'Approved Funds', value: `$${approved_funds.toLocaleString()}` },
    { label: 'Loan Repayable Amount', value: `$${loan_repayments_amount_due_this_month.toLocaleString()}` },
    { label: 'Investment Maturities Amount', value: `$${investment_payouts_amount_due_this_month.toLocaleString()}` },
    { label: 'Active Loans', value: active_loans },
    { label: 'Pending Loans', value: pending_loans }
  ];

  const repaymentBars = chartData?.repayments ?? {};
  const investmentPie = chartData?.investments ?? {};

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Admin Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white p-5 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
            <p className="text-sm text-gray-600 uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Loan Repayments Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Due Amount', amount: repaymentBars.due_amount_this_month || 0 },
                { name: 'Approved', amount: repaymentBars.approved_amount || 0 },
                { name: 'Rejected', amount: repaymentBars.rejected_amount || 0 }
              ]}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="amount" barSize={40} radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Investment Payouts Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Due This Month', value: investmentPie.due_payout_amount_this_month || 0 },
                  { name: 'Total Invested', value: investmentPie.total_invested_amount || 0 }
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={60}
                paddingAngle={5}
                label
              >
                <Cell key="cell-due" />
                <Cell key="cell-total" />
              </Pie>
              <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
