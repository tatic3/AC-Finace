// src/Pages/AdminInvestors.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import debounce from 'lodash.debounce';
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download as DownloadIcon
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminInvestors() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [detailModal, setDetailModal] = useState({ open: false, investor: null });
  const [previews, setPreviews] = useState({});

  const debouncedSearch = useMemo(
    () => debounce(q => setSearchTerm(q), 300),
    []
  );
  const onSearchChange = e => debouncedSearch(e.target.value.trim());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/${tab}-investors`, {
        params: { page, search: searchTerm || undefined }
      });
      setItems(data.investors || []);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error(`Failed to load ${tab} investors`);
    } finally {
      setLoading(false);
    }
  }, [logout, tab, searchTerm, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [tab, searchTerm]);

  const handleAction = async (id, action) => {
    setActionLoading(id);
    try {
      await api.put(`/admin/${action}-investor/${id}`);
      toast.success(`Investor ${action}d`);
      fetchData();
    } catch {
      toast.error(`Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const openDetails = async inv => {
    setDetailModal({ open: true, investor: null });
    setPreviews({});
    try {
      const { data } = await api.get(`/admin/investors/${inv.id}`);
      setDetailModal({ open: true, investor: data });
      ['face_photo','id_document','proof_of_residence'].forEach(async field => {
        try {
          const res = await api.get(
            `/admin/investors/${inv.id}/${field}`,
            { responseType: 'blob' }
          );
          setPreviews(prev => ({ ...prev, [field]: URL.createObjectURL(res.data) }));
        } catch {};
      });
    } catch {
      toast.error('Failed to load details');
      setDetailModal({ open: false, investor: null });
    }
  };

  const downloadDocument = async (id, field, filename) => {
    try {
      const res = await api.get(
        `/admin/investors/${id}/${field}`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${field}-${id}.${filename.split('.').pop()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Investors</h2>

      <div className="flex space-x-4 border-b mb-4">
        {['pending','active','rejected'].map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 ${tab===key?'border-b-2 border-blue-600 text-blue-600':'text-gray-600'}`}
          >{key.charAt(0).toUpperCase()+key.slice(1)}</button>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        <Search className="text-gray-500" size={18} />
        <input
          type="text"
          placeholder="Search by name or email"
          onChange={onSearchChange}
          className="flex-1 p-2 border rounded-md focus:ring focus:ring-blue-300"
        />
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['ID','Name','Email','Phone','Registered','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length===0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No investors found.</td></tr>
              ) : items.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{inv.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{inv.first_name} {inv.surname}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{inv.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{inv.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex space-x-2">
                    <button onClick={() => openDetails(inv)} className="p-1 rounded hover:bg-gray-100"><Eye size={16} /></button>
                    {tab==='pending' && (
                      <>
                        <button onClick={() => handleAction(inv.id,'approve')} disabled={actionLoading===inv.id} className="flex items-center px-3 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200">
                          {actionLoading===inv.id ? <Loader2 className="animate-spin mr-1" size={16}/> : <CheckCircle size={16} className="mr-1"/>} Approve
                        </button>
                        <button onClick={() => handleAction(inv.id,'reject')} disabled={actionLoading===inv.id} className="flex items-center px-3 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200">
                          {actionLoading===inv.id ? <Loader2 className="animate-spin mr-1" size={16}/> : <XCircle size={16} className="mr-1"/>} Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-center space-x-4">
        <button onClick={() => setPage(p => Math.max(p-1,1))} disabled={page<=1||loading} className="p-2 rounded disabled:opacity-50"><ChevronLeft size={20}/></button>
        <span className="text-gray-700">Page {page} of {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(p+1,totalPages))} disabled={page>=totalPages||loading} className="p-2 rounded disabled:opacity-50"><ChevronRight size={20}/></button>
      </div>

      {detailModal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 p-6 rounded-lg overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between mb-4">
              <h3 className="text-xl font-bold">Investor Details</h3>
              <button onClick={() => setDetailModal({ open: false, investor: null })} className="p-1 hover:bg-gray-100 rounded"><XCircle size={24}/></button>
            </div>
            {!detailModal.investor ? (
              <div className="flex justify-center"><Loader2 className="animate-spin"/></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div><strong>Name:</strong> {detailModal.investor.first_name} {detailModal.investor.surname}</div>
                  <div><strong>Email:</strong> {detailModal.investor.email}</div>
                  <div><strong>Phone:</strong> {detailModal.investor.phone}</div>
                  <div><strong>Registered:</strong> {new Date(detailModal.investor.created_at).toLocaleString()}</div>
                  <div><strong>Username:</strong> {detailModal.investor.username}</div>
                  <div><strong>Balance:</strong> ${detailModal.investor.balance.toLocaleString()}</div>
                </div>
                <div className="mb-4"><strong>Documents:</strong></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {['face_photo','id_document','proof_of_residence'].map(field => (
                    <div key={field} className="flex flex-col items-center">
                      {previews[field] ? (
                        <img src={previews[field]} alt={field} className="w-full h-32 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center bg-gray-100 text-gray-500 mb-2">No Preview</div>
                      )}
                      <button onClick={() => downloadDocument(detailModal.investor.id, field, detailModal.investor[field])} className="flex items-center space-x-1 text-blue-600 hover:underline">
                        <DownloadIcon size={16} /><span>Download</span>
                      </button>
                    </div>
                  ))}
                </div>
                {tab==='active' && (
                  <>
                    <h4 className="text-lg font-semibold mb-2">Investments</h4>
                    <ul className="list-disc list-inside mb-4">
                      {detailModal.investor.investments.map(inv => (<li key={inv.id}>{inv.amount} USD — {inv.status}</li>))}
                    </ul>
                    <h4 className="text-lg font-semibold mb-2">Loans</h4>
                    <ul className="list-disc list-inside mb-4">
                      {detailModal.investor.loans.map(loan => (<li key={loan.id}>{loan.amount} USD — {loan.status}</li>))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
