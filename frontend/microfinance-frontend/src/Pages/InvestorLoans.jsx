// src/Pages/InvestorLoans.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from '../api/axios';
import {
  Loader2,
  PlusCircle,
  XCircle,
  Download,
  Search,
  Eye
} from 'lucide-react';
import debounce from 'lodash.debounce';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function InvestorLoans() {
  const navigate = useNavigate();
  const { accessToken, logout } = useAuth();
  useRequireAuth('/investor/login');

  const [tab, setTab] = useState('pending');
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [proofModal, setProofModal] = useState({ open: false, url: null });

  // Fetch loans
  const fetchLoans = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get('/investor/loans', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { status: tab }
      });
      const list = Array.isArray(res.data.loans ? res.data.loans : res.data)
        ? (res.data.loans || res.data)
        : [];
      setLoans(list);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/investor/login', { replace: true });
      } else {
        toast.error('Could not load loans');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, tab, logout, navigate]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Search
  const onSearchChange = useMemo(
    () => debounce(q => setSearchTerm(q.trim().toLowerCase()), 300),
    []
  );
  const filteredLoans = useMemo(() => {
    if (!searchTerm) return loans;
    return loans.filter(loan =>
      loan.loan_id.toString().includes(searchTerm) ||
      loan.amount.toString().includes(searchTerm) ||
      loan.status.toLowerCase().includes(searchTerm)
    );
  }, [loans, searchTerm]);

  // Submit application
  const submitLoan = async e => {
    e.preventDefault();
    if (!amount || !purpose) return toast.error('Please enter amount and purpose');
    setSubmitting(true);
    try {
      await axios.post(
        '/investor/loan-applications',
        { amount: parseFloat(amount), purpose: purpose.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast.success('Application submitted');
      setAmount(''); setPurpose(''); setShowForm(false);
      fetchLoans();
    } catch {
      toast.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Download/view signed docs
  const downloadFile = async (url, filename) => {
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'blob'
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(res.data);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Download failed');
    }
  };
  const openProofModal = async id => {
    try {
      const res = await axios.get(
        `/investor/loans/${id}/signed-docs`,
        { headers: { Authorization: `Bearer ${accessToken}` }, responseType: 'blob' }
      );
      setProofModal({ open: true, url: URL.createObjectURL(res.data) });
    } catch {
      toast.error('Could not load document');
    }
  };
  const closeModal = () => {
    if (proofModal.url) URL.revokeObjectURL(proofModal.url);
    setProofModal({ open: false, url: null });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        {['pending','approved'].map(key=>(
          <button key={key} onClick={()=>setTab(key)} className={`px-4 py-2 rounded font-semibold ${tab===key?'bg-blue-600 text-white':'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
            {key.charAt(0).toUpperCase()+key.slice(1)} Loans
          </button>
        ))}
      </div>

      {/* Apply Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Your {tab} Loans</h2>
        <button onClick={()=>setShowForm(f=>!f)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {showForm?<XCircle className="mr-2"/>:<PlusCircle className="mr-2"/>}{showForm?'Cancel':'Apply for Loan'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submitLoan} className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="grid gap-6">
            <div><label className="block mb-1">Amount ($)</label><input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border rounded p-2"/></div>
            <div><label className="block mb-1">Purpose</label><input type="text" value={purpose} onChange={e=>setPurpose(e.target.value)} className="w-full border rounded p-2"/></div>
            <div className="text-right"><button type="submit" disabled={submitting} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{submitting?<Loader2 className="animate-spin"/>:'Submit'}</button></div>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4 flex items-center bg-white rounded-lg shadow px-4 py-2">
        <Search className="mr-2 text-gray-500"/><input placeholder="Search…" onChange={e=>onSearchChange(e.target.value)} className="w-full focus:outline-none"/>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full">
          <thead className="bg-gray-100"><tr>
            {['ID','Amount','Purpose','Status','Interest Rate','Repayable','Due Date','Guarantor','Documents'].map(col=><th key={col} className="p-3 text-left font-medium text-gray-700">{col}</th>)}
          </tr></thead>
          <tbody>
            {loading?(
              <tr><td colSpan={9} className="p-6 text-center"><Loader2 className="animate-spin text-2xl"/></td></tr>
            ):filteredLoans.length===0?(
              <tr><td colSpan={9} className="p-6 text-center text-gray-500">No loans found.</td></tr>
            ):(
              filteredLoans.map(ln=>(
                <tr key={ln.loan_id} className="hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{ln.loan_id}</td>
                  <td className="p-3 whitespace-nowrap">${ln.amount.toFixed(2)}</td>
                  <td className="p-3 whitespace-nowrap">{ln.purpose}</td>
                  <td className="p-3 whitespace-nowrap capitalize"><span className={ln.status==='approved'?'text-green-600':'text-yellow-600'}>{ln.status}</span></td>
                  <td className="p-3 whitespace-nowrap">{ln.interest_rate}%</td>
                  <td className="p-3 whitespace-nowrap">${ln.total_repayable?.toFixed(2)}</td>
                  <td className="p-3 whitespace-nowrap">{ln.repayment_due_date?new Date(ln.repayment_due_date).toLocaleDateString():'—'}</td>
                  <td className="p-3 whitespace-nowrap">{ln.next_of_kin_details||'—'}</td>
                  <td className="p-3 whitespace-nowrap flex space-x-2">{ln.signed_documents?(<><button onClick={()=>openProofModal(ln.loan_id)} 
                  className="flex items-center"><Eye className="mr-1" size={18}/>View</button><button onClick={()=>downloadFile(`/investor/loans/${ln.loan_id}/signed-docs`,`loan-${ln.loan_id}-docs`)} 
                  className="flex items-center"><Download className="mr-1" size={18}/>Download</button></>):'—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {proofModal.open&&(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-lg w-full">
            <button onClick={closeModal} className="mb-4 text-gray-600 hover:text-gray-800">Close</button>
            <img src={proofModal.url} alt="Document" className="w-full object-contain"/>
          </div>
        </div>
      )}
    </div>
  );
}
