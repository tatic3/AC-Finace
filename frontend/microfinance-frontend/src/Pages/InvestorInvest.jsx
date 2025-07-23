import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import {
  Loader2,
  PlusCircle,
  XCircle,
  Upload
} from 'lucide-react';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function InvestorInvest() {
  useRequireAuth('/investor/login');
  const { accessToken, logout } = useAuth();

  const [tab, setTab] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('1');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(false);

  const getEarliestWithdrawalDate = iso => {
    const mat = new Date(iso);
    const day = mat.getDate();
    if (day >= 28 || day <= 8) return mat;
    return new Date(mat.getFullYear(), mat.getMonth(), 28);
  };

  const fetchInvestments = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get('/investor/investments', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { status: tab }
      });
      const list = Array.isArray(res.data.investments)
        ? res.data.investments
        : Array.isArray(res.data)
        ? res.data
        : [];
      setInvestments(list);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error('Could not load investments');
    } finally {
      setLoading(false);
    }
  }, [accessToken, logout, tab]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const handleInvest = async e => {
    e.preventDefault();
    if (!amount || !proofFile) {
      return toast.error('Please enter amount and upload proof');
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('amount', amount);
      form.append('duration_months', duration);
      form.append('proof', proofFile);
      await axios.post('/investor/invest', form, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Investment submitted – awaiting approval');
      setAmount('');
      setDuration('1');
      setProofFile(null);
      setShowForm(false);
      fetchInvestments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Investment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const requestWithdrawal = async id => {
    try {
      await axios.post(
        `/investor/request-withdrawal/${id}`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast.success('Withdrawal requested');
      fetchInvestments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Request failed');
    }
  };

  // Removed 'completed' tab as requested
  const tabs = ['pending', 'approved', 'rejected'];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold">Invest Funds</h2>

      <div className="flex space-x-4">
        {tabs.map(s => (
          <button
            key={s}
            onClick={() => { setTab(s); setShowForm(false); }}
            className={`px-4 py-2 rounded font-semibold transition ${
              tab === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold">
          Your {tab.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Investments
        </h3>
        {tab === 'pending' && (
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            {showForm ? <XCircle className="mr-2" /> : <PlusCircle className="mr-2" />}
            {showForm ? 'Cancel' : 'New Investment'}
          </button>
        )}
      </div>

      {showForm && tab === 'pending' && (
        <form onSubmit={handleInvest} className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Amount ($)</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Duration (months)</label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {m} month{m > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Proof of Payment</label>
              <label className="mt-1 flex items-center space-x-2 cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={e => setProofFile(e.target.files[0])}
                />
                {submitting ? (
                  <Loader2 className="animate-spin text-xl" />
                ) : (
                  <Upload className="text-blue-600 text-xl" />
                )}
                <span>{proofFile ? proofFile.name : 'Choose file'}</span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Submitting…' : 'Submit Investment'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {[
                'ID',
                'Amount',
                'Duration',
                'Start-Date',
                'Maturity-Date',
                'Earliest Withdrawable',
                'Expected Withdrawal Amount',
                'Status',
                'Action'
              ].map(h => (
                <th key={h} className="p-3 text-left font-medium text-gray-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center">
                  <Loader2 className="animate-spin text-2xl" />
                </td>
              </tr>
            ) : investments.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No investments in this category.
                </td>
              </tr>
            ) : (
              investments.map(inv => {
                const start = new Date(inv.created_at);
                const maturity = new Date(inv.expected_withdrawal_date);
                const earliest = getEarliestWithdrawalDate(maturity.toISOString());
                const today = new Date();
                const canRequest = inv.status === 'approved' && today >= earliest;
                const expectedAmt = inv.expected_withdrawal_amount != null
                  ? inv.expected_withdrawal_amount
                  : +(inv.amount * Math.pow(1 + inv.rate / 100, inv.duration_months)).toFixed(2);

                return (
                  <tr key={inv.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{inv.id}</td>
                    <td className="p-3">${inv.amount.toFixed(2)}</td>
                    <td className="p-3">{inv.duration_months} mo</td>
                    <td className="p-3">{start.toLocaleDateString()}</td>
                    <td className="p-3">{maturity.toLocaleDateString()}</td>
                    <td className="p-3">{earliest.toLocaleDateString()}</td>
                    <td className="p-3">${expectedAmt.toFixed(2)}</td>
                    <td className="p-3 capitalize">
                      {inv.status.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      {tab === 'approved' && canRequest && (
                        <button
                          onClick={() => requestWithdrawal(inv.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Request Withdrawal
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
