// src/Pages/AdminLoans.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminLoans() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const TABS = ['pending','active','due'];
  const [tab, setTab] = useState('pending');
  const [lists, setLists] = useState({ pending: [], active: [], due: [] });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [detail, setDetail] = useState({ open: false, loan: null, investor: null, repayments: [] });
  const [infoModal, setInfoModal] = useState({ open: false, loanId: null, collateral: '', nextOfKin: '', file: null, loading: false });

  const debouncedSearch = useMemo(
    () => debounce(q => { setSearchTerm(q); setPage(1); }, 500),
    []
  );
  const handleSearch = e => debouncedSearch(e.target.value.trim());

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = (tab === 'active' || tab === 'due') ? 'approved' : tab;
      const params = { status: statusParam, search: searchTerm || undefined, page };
      const { data } = await api.get('/admin/loans', { params });
      let dataList = data.loans || [];
      if (tab === 'due') {
        const now = Date.now();
        dataList = dataList.filter(l => {
          const due = l.repayment_due_date
            ? new Date(l.repayment_due_date).getTime()
            : l.approved_at
              ? new Date(l.approved_at).getTime() + 30*24*60*60*1000
              : Infinity;
          return due <= now;
        });
      }
      setLists(prev => ({ ...prev, [tab]: dataList }));
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error(err.response?.data?.error || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [logout, tab, searchTerm, page]);

  useEffect(() => { if (accessToken) fetchLoans(); }, [accessToken, fetchLoans]);
  useEffect(() => { setPage(1); }, [tab]);

  const handleAction = async (loanId, type) => {
    setActionLoading(prev => ({ ...prev, [loanId]: true }));
    try {
      await api.put(`/admin/${type}-loan/${loanId}`);
      toast.success(`Loan ${type}d successfully`);
      fetchLoans();
    } catch (err) {
      toast.error(err.response?.data?.error || `${type} failed`);
    } finally {
      setActionLoading(prev => ({ ...prev, [loanId]: false }));
    }
  };

  const openDetails = async loanId => {
    try {
      const { data } = await api.get(`/admin/loans/${loanId}`);
      setDetail({ open: true, loan: data.loan, investor: data.investor, repayments: data.repayments });
    } catch {
      toast.error('Failed to load loan details');
    }
  };
  const closeModal = () => setDetail({ open: false, loan: null, investor: null, repayments: [] });

  const openInfoModal = loan => setInfoModal({ open: true, loanId: loan.loan_id, collateral: loan.collateral || '', nextOfKin: loan.next_of_kin_details || '', file: null, loading: false });
  const closeInfoModal = () => setInfoModal(prev => ({ ...prev, open: false }));

  const submitInfo = async () => {
    const { loanId, collateral, nextOfKin, file } = infoModal;
    setInfoModal(prev => ({ ...prev, loading: true }));
    const form = new FormData();
    form.append('collateral_description', collateral);
    form.append('next_of_kin_name', nextOfKin);
    if (file) form.append('signed_docs', file);
    try {
      await api.post(`/admin/loans/${loanId}/add-info`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Loan info updated');
      closeInfoModal();
      fetchLoans();
    } catch {
      toast.error('Update failed');
    } finally {
      setInfoModal(prev => ({ ...prev, loading: false }));
    }
  };

  const downloadSigned = async () => {
    if (!detail.loan) return;
    try {
      const res = await api.get(
        `/admin/loans/${detail.loan.loan_id}/signed-docs`,
        { responseType: 'blob' }
      );
      window.open(URL.createObjectURL(res.data));
    } catch {
      toast.error('Cannot load document');
    }
  };

  const formatDue = loan => {
    if (loan.repayment_due_date) return new Date(loan.repayment_due_date).toLocaleDateString();
    if (loan.approved_at) {
      const d = new Date(loan.approved_at);
      d.setDate(d.getDate() + 30);
      return d.toLocaleDateString();
    }
    return '—';
  };

  const list = lists[tab];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Loans</h2>

      <div className="flex space-x-4 border-b mb-4">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'pb-2 border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center mb-4 space-x-2">
        <Search size={18} className="text-gray-500" />
        <input
          type="text"
          placeholder="Search by investor or ID"
          onChange={handleSearch}
          className="flex-1 p-2 border rounded focus:ring focus:ring-blue-300"
        />
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['ID','Investor','Amount','Applied','Approved','Due Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">No loans</td></tr>
              ) : list.map(loan => (
                <tr key={loan.loan_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{loan.loan_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{loan.investor_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">${loan.amount}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(loan.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {loan.approved_at ? new Date(loan.approved_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDue(loan)}</td>
                  <td className="px-4 py-3 flex space-x-2">
                    <button onClick={() => openDetails(loan.loan_id)} className="p-1 hover:bg-gray-100 rounded"><Eye size={16}/></button>
                    {tab === 'pending' && (
                      <>  
                        <button onClick={() => handleAction(loan.loan_id,'approve')} disabled={actionLoading[loan.loan_id]} className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"><CheckCircle/></button>
                        <button onClick={() => handleAction(loan.loan_id,'reject')} disabled={actionLoading[loan.loan_id]} className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"><XCircle/></button>
                        <button onClick={() => openInfoModal(loan)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Add Info</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-center space-x-2 mt-4">
        <button onClick={() => setPage(p => Math.max(p-1,1))} disabled={page<=1||loading} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
        <span className="px-3 py-1">{page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(p+1,totalPages))} disabled={page>=totalPages||loading} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
      </div>

      {/* Details Modal */}
      {detail.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-11/12 md:w-3/4 lg:w-1/2 p-6 rounded-lg overflow-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Loan Details</h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded"><XCircle size={24}/></button>
            </div>
            {/* Loan & Investor Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div><strong>Investor:</strong> {detail.investor.name}</div>
              <div><strong>Email:</strong> {detail.investor.email}</div>
              <div><strong>Phone:</strong> {detail.investor.phone}</div>
              <div><strong>Collateral:</strong> {detail.loan.collateral}</div>
              <div><strong>Next of Kin:</strong> {detail.loan.next_of_kin_details}</div>
              <div><strong>Applied:</strong> {new Date(detail.loan.submitted_at).toLocaleString()}</div>
              <div><strong>Approved:</strong> {detail.loan.approved_at ? new Date(detail.loan.approved_at).toLocaleString() : '—'}</div>
              <div><strong>Repayment Due:</strong> {formatDue(detail.loan)}</div>
              {detail.loan.signed_documents && (
                <div className="sm:col-span-2">
                  <button onClick={downloadSigned} className="text-blue-600 hover:underline">View Signed Docs</button>
                </div>
              )}
            </div>
            {/* Repayments History */}
            {detail.repayments.length ? (
              <ul className="list-disc list-inside space-y-2">
                {detail.repayments.map(r=> (
                  <li key={r.repayment_id} className="text-sm text-gray-700">
                    {new Date(r.date_paid).toLocaleDateString()}: ${r.amount_paid} — {r.status}
                    <a href={r.proof} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline ml-2">Proof</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No repayments found.</p>
            )}
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-11/12 md:w-1/2 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Add Loan Info</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Collateral Description</label>
                <textarea
                  value={infoModal.collateral}
                  onChange={e => setInfoModal(m => ({ ...m, collateral: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Next of Kin Details</label>
                <input
                  type="text"
                  value={infoModal.nextOfKin}
                  onChange={e => setInfoModal(m => ({ ...m, nextOfKin: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Signed Documents</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setInfoModal(m => ({ ...m, file: e.target.files[0] }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button onClick={closeInfoModal} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
              <button
                onClick={submitInfo}
                disabled={infoModal.loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {infoModal.loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
