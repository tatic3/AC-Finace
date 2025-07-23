import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import debounce from 'lodash.debounce';
import {
  Loader2,
  Search
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminWithdrawals() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);

  const debouncedSearch = useMemo(
    () => debounce(q => setSearchTerm(q), 300),
    []
  );
  const onSearchChange = e => debouncedSearch(e.target.value.trim());

  useEffect(() => {
    if (!accessToken) return;
    let cancel = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const params = { status: tab, search: searchTerm || undefined, page };
        const res = await api.get('/admin/withdrawals', { headers, params });
        if (cancel) return;
        const raw = res.data;
        const list = Array.isArray(raw)
          ? raw
          : raw.withdrawals || [];
        const pages = raw.total_pages || totalPages;
        setItems(list);
        setTotalPages(pages);
      } catch (err) {
        if (err.response?.status === 401) logout();
        else toast.error('Failed to load withdrawals');
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    fetchData();
    return () => { cancel = true; };
  }, [accessToken, logout, tab, searchTerm, page, refreshFlag]);

  useEffect(() => {
    setPage(1);
  }, [tab, searchTerm]);

  const openApproveModal = id => {
    setCurrentId(id);
    setProofFile(null);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const submitApprove = async () => {
    if (!proofFile) return toast.error('Select a proof file');
    setModalLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data'
      };
      const form = new FormData();
      form.append('proof_of_payment', proofFile);
      await api.post(
        `/admin/withdrawals/${currentId}/approve`,
        form,
        { headers }
      );
      toast.success('Withdrawal approved');
      setRefreshFlag(f => f + 1);
      closeModal();
    } catch {
      toast.error('Approval failed');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Withdrawals</h2>

      <div className="flex space-x-4 border-b mb-4">
        {['pending', 'paid', 'completed'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'pb-2 border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600'
            }
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center mb-4">
        <Search size={18} />
        <input
          type="text"
          onChange={onSearchChange}
          placeholder="Search by ID or investor"
          className="border p-2 rounded ml-2"
        />
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Investor</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">No withdrawals</td>
                </tr>
              ) : (
                items.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">{w.id}</td>
                    <td className="px-4 py-2 text-gray-700">{w.investor_name}</td>
                    <td className="px-4 py-2 text-gray-700">
                      ${w.expected_withdrawal_amount?.toFixed(2) ?? w.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{new Date(w.date_requested).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      {tab === 'pending' && (
                        <button
                          onClick={() => openApproveModal(w.id)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >Approve</button>
                      )}
                      {tab !== 'pending' && (
                        <span className="capitalize text-gray-600">{w.status}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-center space-x-2 mt-4">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page <= 1 || loading}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >Prev</button>
        <span className="px-3 py-1">{page} / {totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          disabled={page >= totalPages || loading}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >Next</button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Upload Proof of Payment</h3>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setProofFile(e.target.files[0])}
              className="mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
              <button
                onClick={submitApprove}
                disabled={!proofFile || modalLoading}
                className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
              >
                {modalLoading ? <Loader2 className="animate-spin inline-block" /> : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
