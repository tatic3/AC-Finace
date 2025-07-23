import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import debounce from 'lodash.debounce';
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Download as DownloadIcon,
  Eye,
  X as CloseIcon
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminRepayments() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [refreshFlag, setRefreshFlag] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const selectAllRef = useRef();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ url: '', filename: '' });

  const debouncedSearch = useMemo(() => debounce(term => {
    setSearchTerm(term);
    setPage(1);
  }, 500), []);

  useEffect(() => () => debouncedSearch.cancel(), []);

  const fetchData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const statusParam = tab === 'completed' ? 'approved' : 'pending';
      const params = { status: statusParam, page };
      if (searchTerm) params.query = searchTerm;
      const res = await api.get('/admin/loan-repayments', { headers, params });
      setItems(res.data.repayments.map(r => ({
        ...r,
        selected: false,
        repaymentDue: r.expected_amount ?? (parseFloat(r.amount) * (1 + parseFloat(r.interest_rate)/100)),
        investorName: r.investor_name,
        proofUrl: r.proof_url
      })));
      setTotalPages(res.data.pages);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [accessToken, tab, page, searchTerm, refreshFlag]);

  useEffect(() => {
    const all = items.length > 0 && items.every(i => i.selected);
    const some = items.some(i => i.selected);
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !all && some;
    }
  }, [items]);

  const handleAction = async (id, type) => {
    setActionLoading(al => ({ ...al, [id]: true }));
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      if (type === 'approve') {
        await api.post('/admin/approve-repayment', { repayment_ids: [id] }, { headers });
      } else {
        await api.post('/admin/reject-repayment', { repayment_id: id }, { headers });
      }
      toast.success(`Repayment ${type}d`);
      setRefreshFlag(f => f + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || `${type} failed`);
    } finally {
      setActionLoading(al => ({ ...al, [id]: false }));
    }
  };

  const bulkAction = async type => {
    const ids = items.filter(i => i.selected).map(i => i.repayment_id);
    if (!ids.length) return toast.error('Please select at least one repayment');
    setActionLoading(al => ({ ...al, bulk: true }));
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      if (type === 'approve') {
        await api.post('/admin/approve-repayment', { repayment_ids: ids }, { headers });
      } else {
        await Promise.all(
          ids.map(id => api.post('/admin/reject-repayment', { repayment_id: id }, { headers }))
        );
      }
      toast.success(`Repayments ${type}d`);
      setRefreshFlag(f => f + 1);
    } catch (err) {
      toast.error(err.response?.data?.error || `Bulk ${type} failed`);
    } finally {
      setActionLoading(al => ({ ...al, bulk: false }));
    }
  };

  const viewProof = async (url, filename) => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await api.get(url, { headers, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      setModalData({ url: blobUrl, filename });
      setModalOpen(true);
    } catch {
      toast.error('Failed to load proof');
    }
  };

  const downloadProof = async (url, filename) => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await api.get(url, { headers, responseType: 'blob' });
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
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Repayments</h2>

      {/* Tabs */}
      <div className="flex space-x-4 border-b mb-4">
        {['pending','completed'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab===t
                ? 'pb-2 border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600'
            }
          >{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {/* Search & Bulk */}
      <div className="flex flex-col sm:flex-row justify-between mb-4">
        <div className="flex items-center space-x-2 mb-2 sm:mb-0">
          <Search size={18}/>
          <input
            type="text"
            onChange={e => debouncedSearch(e.target.value)}
            placeholder="Search by Loan ID"
            className="border p-2 rounded"
          />
        </div>
        <div className="flex space-x-2">
          <button onClick={()=>bulkAction('approve')} disabled={actionLoading.bulk} className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50">
            {actionLoading.bulk? <Loader2 className="animate-spin inline-block"/>:'Approve Selected'}
          </button>
          <button onClick={()=>bulkAction('reject')} disabled={actionLoading.bulk} className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50">
            {actionLoading.bulk? <Loader2 className="animate-spin inline-block"/>:'Reject Selected'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2"><input type="checkbox" ref={selectAllRef} checked={items.every(i => i.selected)} onChange={e=>setItems(items.map(i=>({...i,selected:e.target.checked})))} /></th>
                <th className="px-4 py-2 text-left">Loan ID</th>
                <th className="px-4 py-2 text-left">Investor</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Repayment Amount Due</th>
                <th className="px-4 py-2 text-left">Proof</th>
                <th className="px-4 py-2 text-left">Date & Time</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-gray-500">No {searchTerm ? `results for "${searchTerm}"` : 'repayments'}.</td></tr>
              )}
              {items.map(r => (
                <tr key={r.repayment_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2"><input type="checkbox" checked={r.selected} onChange={()=>setItems(items.map(i=>i.repayment_id===r.repayment_id?{...i,selected:!i.selected}:i))}/></td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.loan_id}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.investorName}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      r.status==='approved' ? 'bg-green-100 text-green-700' :
                      r.status==='rejected'? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">${r.repaymentDue.toFixed(2)}</td>
                  <td className="px-4 py-2 flex space-x-2">
                    <Eye className="cursor-pointer text-gray-600 hover:text-gray-800" onClick={()=>viewProof(r.proofUrl,`proof-${r.repayment_id}`)}/>
                    <DownloadIcon className="cursor-pointer text-blue-600 hover:text-blue-800" onClick={()=>downloadProof(r.proofUrl,`proof-${r.repayment_id}`)}/>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{new Date(r.date_paid).toLocaleString()}</td>
                  <td className="px-4 py-2 flex space-x-2">
                    {tab==='pending' && (
                      <>
                        <button onClick={()=>handleAction(r.repayment_id,'approve')} disabled={actionLoading[r.repayment_id]} className="p-1 bg-green-100 text-green-700 rounded disabled:opacity-50 hover:bg-green-200">
                          {actionLoading[r.repayment_id] ? <Loader2 className="animate-spin w-4 h-4"/> : <CheckCircle/>}
                        </button>
                        <button onClick={()=>handleAction(r.repayment_id,'reject')} disabled={actionLoading[r.repayment_id]} className="p-1 bg-red-100 text-red-700 rounded disabled:opacity-50 hover:bg-red-200">
                          {actionLoading[r.repayment_id] ? <Loader2 className="animate-spin w-4 h-4"/> : <XCircle/>}
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

      {/* Pagination */}
      <div className="flex justify-center space-x-2 mt-4">
        <button onClick={()=>setPage(p=>Math.max(p-1,1))} disabled={page<=1||loading} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
        <span className="px-3 py-1">{page} / {totalPages}</span>
        <button onClick={()=>setPage(p=>Math.min(p+1,totalPages))} disabled={page>=totalPages||loading} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[90vw] max-w-6xl p-6 relative">
            <button onClick={()=>setModalOpen(false)} className="absolute top-2 right-2"><CloseIcon/></button>
            <div className="h-[80vh] overflow-auto">
              <iframe src={modalData.url} title={modalData.filename} className="w-full h-full"/>
            </div>
            <div className="mt-4 text-right">
              <button onClick={()=>downloadProof(modalData.url, modalData.filename)} className="px-4 py-2 bg-blue-600 text-white rounded">Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
