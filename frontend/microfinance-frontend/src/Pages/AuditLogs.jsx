// src/Pages/AuditLogs.jsx
import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import debounce from 'lodash.debounce';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AuditLogs() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);

    api.get('/admin/audit-logs')
      .then(res => {
        if (cancelled) return;
        const all = res.data.logs || [];
        setLogs(all);
        setFilteredLogs(all);
      })
      .catch(err => {
        if (err.response?.status === 401) {
          toast.error('Session expired');
          logout();
        } else {
          toast.error('Failed to load audit logs');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [accessToken, logout]);

  const handleSearch = debounce(text => {
    const term = text.toLowerCase();
    setFilteredLogs(
      logs.filter(log =>
        log.id.toString().includes(term) ||
        log.role.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        (log.ip_address || '').toLowerCase().includes(term)
      )
    );
  }, 300);

  const onSearchChange = e => {
    const val = e.target.value;
    setQuery(val);
    handleSearch(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Audit Logs</h2>
        <input
          type="text"
          value={query}
          onChange={onSearchChange}
          placeholder="Search by ID, role, action, IP address"
          className="px-4 py-2 border rounded-md focus:ring focus:ring-blue-200 w-full max-w-sm"
        />
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Action</th>
              <th className="px-4 py-2 text-left">Details</th>
              <th className="px-4 py-2 text-left">IP Address</th>
              <th className="px-4 py-2 text-left">User Agent</th>
              <th className="px-4 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center">
                  <Loader2 className="animate-spin text-gray-500" size={32} />
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No logs found
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => {
                const ts = new Date(log.timestamp).getTime();
                return (
                  <tr key={`${log.id}-${ts}`}>  
                    <td className="px-4 py-2 whitespace-nowrap">{log.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{log.role}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{log.action}</td>
                    <td className="px-4 py-2 truncate max-w-xs">{log.details || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{log.ip_address}</td>
                    <td className="px-4 py-2 truncate max-w-sm">{log.user_agent}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
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
