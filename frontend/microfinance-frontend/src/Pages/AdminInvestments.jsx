import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import {
  Loader2,
  Search,
  Download,
  Eye,
  CheckCircle,
  XCircle as RejectIcon,
  CheckSquare as ReapproveIcon
} from 'lucide-react';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminInvestments() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const isSuperAdmin = useMemo(() => {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      return payload.sub === 1 || payload.sub === '1';
    } catch {
      return false;
    }
  }, [accessToken]);

  const [tab, setTab] = useState('pending');
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [sortBy, setSortBy] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [proofModal, setProofModal] = useState({ open: false, url: null });

  const debouncedSearch = useMemo(() => debounce(q => setSearchTerm(q), 500), []);
  const onSearchChange = e => debouncedSearch(e.target.value.trim());

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const params = { status: tab, sort_by: sortBy, order, search: searchTerm || undefined };
      const res = await api.get('/admin-investments', { headers, params });
      setInvestments(res.data.investments || []);
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Session expired.'); logout();
      } else {
        toast.error(err.response?.data?.error || 'Failed to load investments');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, logout, tab, sortBy, order, searchTerm]);

  useEffect(() => { if (accessToken) fetchInvestments(); }, [accessToken, fetchInvestments]);

  const handleAction = async (id, actionType) => {
    setActionLoading(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [actionType]: true } }));
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      await api.put(`/admin/${actionType}-investment/${id}`, {}, { headers });
      toast.success(`Investment ${actionType}d`);
      fetchInvestments();
    } catch {
      toast.error(`Failed to ${actionType}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [actionType]: false } }));
    }
  };

  const openProofModal = async id => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await api.get(`/admin/investments/${id}/proof_of_payment`, { headers, responseType: 'blob' });
      setProofModal({ open: true, url: URL.createObjectURL(res.data) });
    } catch {
      toast.error('Could not load proof.');
    }
  };

  const downloadProof = async id => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await api.get(`/admin/investments/${id}/proof_of_payment`, { headers, responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `proof_of_payment_${id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  const closeProofModal = () => {
    if (proofModal.url) URL.revokeObjectURL(proofModal.url);
    setProofModal({ open: false, url: null });
  };

  const getStatusBadge = status => {
    const base = 'px-2 py-1 rounded-full text-xs font-semibold';
    const colors = {
      approved: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return `${base} ${colors[status] || 'bg-gray-100 text-gray-700'}`;
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">All Investments</h2>

      {/* Tabs */}
      <div className="flex space-x-4 border-b mb-4">
        {['pending','approved','rejected'].map(key => (
          <button
            key={key}
            onClick={() => { setTab(key); setActionLoading({}); }}
            className={`pb-2 ${tab===key?'border-b-2 border-blue-600 text-blue-600':'text-gray-600 hover:text-blue-600'}`}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <Search size={18} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search by investor or ID"
            onChange={onSearchChange}
            className="p-2 border rounded focus:ring focus:ring-blue-300"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Sort By:</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="p-2 border rounded focus:ring focus:ring-blue-300"
          >
            <option value="created_at">Date Submitted</option>
            <option value="amount">Amount</option>
          </select>
          <button
            onClick={() => setOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
            className="p-2 rounded border hover:bg-gray-100"
          >
            {order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['ID','Investor','Amount','Rate','Duration','Status','Submitted','Withdrawal Date','Proof','Actions'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {investments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    No investments found.
                  </td>
                </tr>
              ) : (
                investments.map(inv => {
                  const submitted = new Date(inv.created_at);
                  const maturity = new Date(submitted);
                  maturity.setMonth(maturity.getMonth() + inv.duration_months);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{inv.id}</td>
                      <td className="px-4 py-3">{inv.investor_name}</td>
                      <td className="px-4 py-3">${inv.amount}</td>
                      <td className="px-4 py-3">{inv.rate}%</td>
                      <td className="px-4 py-3">{inv.duration_months} mo</td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(inv.status)}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3">{submitted.toLocaleDateString()}</td>
                      <td className="px-4 py-3">{maturity.toLocaleDateString()}</td>
                      <td className="px-4 py-3 space-x-2">
                        <button
                          onClick={() => openProofModal(inv.id)}
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <Eye size={16} className="mr-1" />View
                        </button>
                        <button
                          onClick={() => downloadProof(inv.id)}
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <Download size={16} className="mr-1" />Download
                        </button>
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        {inv.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAction(inv.id, 'approve')}
                              disabled={actionLoading[inv.id]?.approve}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => handleAction(inv.id, 'reject')}
                              disabled={actionLoading[inv.id]?.reject}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                            >
                              <RejectIcon size={16} />
                            </button>
                          </>
                        )}
                        {inv.status === 'rejected' && isSuperAdmin && (
                          <button
                            onClick={() => handleAction(inv.id, 'reapprove')}
                            disabled={actionLoading[inv.id]?.reapprove}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                          >
                            <ReapproveIcon size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
      {/* Proof Modal */}
      {proofModal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 p-4 rounded-lg relative">
            <button
              onClick={closeProofModal}
              className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
            >
              <RejectIcon size={24} />
            </button>
            <img
              src={proofModal.url}
              alt="Proof of Payment"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
