// src/Pages/InvestorRepayments.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';
import api from '../api/axios';
import { Loader2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';

export default function InvestorRepayments() {
  useRequireAuth('/investor/login');
  const { accessToken, logout } = useAuth();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({});
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'overdue' | 'completed'

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(q => {
      setSearchText(q.trim());
      setPage(1);
    }, 300),
    []
  );
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // Fetch loans based on tab
  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === 'completed' ? 'repaid' : 'approved';
      const res = await api.get('/investor/loans', {
        params: { status: statusParam, search: searchText, page },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setLoans(res.data.loans || []);
      setPages(res.data.pages || 1);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error('Failed to load loans for repayment.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, logout, page, searchText, tab]);

  useEffect(() => { if (accessToken) fetchLoans(); }, [accessToken, fetchLoans]);

  // Compute daysLeft and expectedAmount
  const processed = useMemo(() => {
    const now = Date.now();
    return loans.map(l => {
      const dueMs = l.repayment_due_date ? new Date(l.repayment_due_date).getTime() : null;
      const daysLeft = dueMs != null ? Math.ceil((dueMs - now) / 86400000) : null;
      const principal = parseFloat(l.amount);
      const rate = parseFloat(l.interest_rate || 0) / 100;
      const expectedAmount = principal * (1 + rate);
      return { ...l, daysLeft, dueDate: dueMs ? new Date(dueMs) : null, expectedAmount };
    });
  }, [loans]);

  // Filter by search
  const filtered = useMemo(
    () => searchText
      ? processed.filter(l =>
          l.loan_id.toString().includes(searchText) ||
          l.expectedAmount.toFixed(2).includes(searchText)
        )
      : processed,
    [processed, searchText]
  );

  // Determine which to show based on tab
  const shown = useMemo(() => {
    if (tab === 'upcoming') {
      return filtered.filter(l => l.daysLeft != null && l.daysLeft >= 0 && l.daysLeft <= 5);
    } else if (tab === 'overdue') {
      return filtered.filter(l => l.daysLeft != null && l.daysLeft < 0);
    } else {
      return filtered; // completed fetched as 'repaid'
    }
  }, [filtered, tab]);

  // Submit proof
  const handleFileUpload = async (loanId, proofFile) => {
    if (!proofFile) return;
    setUploading(u => ({ ...u, [loanId]: true }));

    const form = new FormData();
    form.append('loan_id', loanId);
    form.append('proof', proofFile);

    try {
      await api.post('/investor/repay', form, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast.success('Repayment submitted successfully');
      fetchLoans();
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Unauthorized: you can only repay your own loans');
      } else {
        toast.error(err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setUploading(u => ({ ...u, [loanId]: false }));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Loan Repayments</h2>

      {/* tabs */}
      <div className="flex space-x-4 mb-6">
        {['upcoming','overdue','completed'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded font-semibold ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t === 'upcoming'
              ? 'Due in 5 Days'
              : t.charAt(0).toUpperCase() + t.slice(1)
            }
          </button>
        ))}
      </div>

      {/* search */}
      <div className="flex items-center mb-4 space-x-2">
        <Calendar className="text-gray-600" />
        <input
          type="text"
          placeholder="Search by ID or amount…"
          onChange={e => debouncedSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2 focus:outline-none"
        />
      </div>

      {/* table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Loan ID</th>
              <th className="p-3 text-left">Amount Due</th>
              <th className="p-3 text-left">Due Date</th>
              <th className="p-3 text-left">Days Left</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center">
                  <Loader2 className="animate-spin mx-auto" />
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No {tab === 'upcoming' ? 'upcoming' : tab === 'overdue' ? 'overdue' : 'completed'} repayments.
                </td>
              </tr>
            ) : (
              shown.map(loan => (
                <motion.tr
                  key={loan.loan_id}
                  className="border-t hover:bg-gray-50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <td className="p-3">{loan.loan_id}</td>
                  <td className="p-3">${loan.expectedAmount.toFixed(2)}</td>
                  <td className="p-3">{loan.dueDate ? loan.dueDate.toLocaleDateString() : '—'}</td>
                  <td className={`p-3 ${loan.daysLeft < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {loan.daysLeft != null
                      ? loan.daysLeft >= 0
                        ? `${loan.daysLeft}d`
                        : 'Overdue'
                      : '—'
                    }
                  </td>
                  <td className="p-3">
                    {(tab === 'overdue') && (
                      <>  
                        <input
                          id={`upload-${loan.loan_id}`} type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={uploading[loan.loan_id]}
                          onChange={e => handleFileUpload(loan.loan_id, e.target.files[0])}
                        />
                        <label
                          htmlFor={`upload-${loan.loan_id}`}
                          className={`px-3 py-1 rounded ${
                            uploading[loan.loan_id]
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                          }`}
                        >
                          {uploading[loan.loan_id]
                            ? <Loader2 className="animate-spin inline-block" />
                            : 'Repay'
                          }
                        </label>
                      </>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="mt-4 flex justify-center space-x-2">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i+1}
            onClick={() => setPage(i+1)}
            className={`px-4 py-1 border rounded ${page === i+1 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
          >
            {i+1}
          </button>
        ))}
      </div>
    </div>
  );
}
