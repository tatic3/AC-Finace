import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { Loader2, Search, Eye, Download as DownloadIcon, CheckCircle, XCircle } from 'lucide-react';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { useAuth } from "../hooks/AuthContext.jsx";
import useRequireAuth from "../hooks/useRequireAuth.js";

export default function InvestorWithdrawals() {
  useRequireAuth('/investor/login');
  const { accessToken, logout } = useAuth();

  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tab, setTab] = useState('pending');
  const [modalUrl, setModalUrl] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const onSearchChange = useMemo(
    () => debounce(value => setSearchText(value.trim().toLowerCase()), 300),
    []
  );
  useEffect(() => () => onSearchChange.cancel(), [onSearchChange]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/investor/withdrawals', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setWithdrawals(res.data.withdrawals || res.data || []);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchWithdrawals();
  }, [accessToken]);

  const filtered = withdrawals
    .filter(w => w.status === tab)
    .filter(w => {
      if (!searchText) return true;
      const expected = w.expected_withdrawal_amount ?? w.amount;
      return [
        w.id.toString(),
        w.investment_id.toString(),
        expected.toFixed(2),
        w.status
      ].some(field => field.toLowerCase().includes(searchText));
    });

  const confirmReceipt = async id => {
    try {
      await api.post(
        `/investor/confirm-withdrawal/${id}`,
        null,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast.success('Withdrawal confirmed');
      fetchWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Confirmation failed');
    }
  };

  // fetch proof with auth and show in modal
  const viewProof = async filename => {
    try {
      setLoading(true);
      const res = await api.get(
        `/investor/withdrawal-proof/${filename}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, responseType: 'blob' }
      );
      const blobUrl = URL.createObjectURL(res.data);
      setModalUrl(blobUrl);
      setModalOpen(true);
    } catch (err) {
      toast.error('Unable to load proof');
    } finally {
      setLoading(false);
    }
  };

  const downloadProof = async filename => {
    try {
      const res = await api.get(
        `/investor/withdrawal-proof/${filename}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, responseType: 'blob' }
      );
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Your Withdrawals</h2>

      {/* Tabs */}
      <div className="flex space-x-4 mb-4">
        {['pending', 'paid', 'completed'].map(status => (
          <button
            key={status}
            onClick={() => setTab(status)}
            className={`px-4 py-2 font-medium rounded ${
              tab === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center mb-4">
        <Search className="mr-2 text-gray-500" />
        <input
          type="text"
          placeholder="Filter by ID, investment, amount or status…"
          onChange={e => onSearchChange(e.target.value)}
          className="flex-1 border rounded px-3 py-2 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {['ID','Investment ID','Amount Due','Date','Status','Proof','Actions'].map(h => (
                <th key={h} className="p-3 text-left font-medium text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="animate-spin text-2xl" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">No withdrawals.</td></tr>
            ) : (
              filtered.map(w => {
                const expected = w.expected_withdrawal_amount ?? w.amount;
                return (
                  <tr key={w.id} className="hover:bg-gray-50 border-t">
                    <td className="p-3">{w.id}</td>
                    <td className="p-3">{w.investment_id}</td>
                    <td className="p-3">${expected.toFixed(2)}</td>
                    <td className="p-3">{new Date(w.date_requested).toLocaleDateString()}</td>
                    <td className="p-3 capitalize">{w.status}</td>
                    <td className="p-3 flex space-x-2">
                      {w.proof_of_payment && (
                        <>
                          <Eye className="cursor-pointer text-gray-600 hover:text-gray-800" size={18} onClick={() => viewProof(w.proof_of_payment)} />
                          <DownloadIcon className="cursor-pointer text-blue-600 hover:text-blue-800" size={18} onClick={() => downloadProof(w.proof_of_payment)} />
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      {w.status === 'paid' && (
                        <button
                          onClick={() => confirmReceipt(w.id)}
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <CheckCircle size={16} className="mr-1" />Confirm
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

      {/* Proof Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[90vw] max-w-3xl p-4 relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-2 right-2">
              <XCircle size={24} />
            </button>
            <iframe src={modalUrl} className="w-full h-[80vh]" title="Proof of Payment" />
          </div>
        </div>
      )}
    </div>
  );
}