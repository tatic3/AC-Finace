import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, PlusCircle, Trash2, Key } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminManagement() {
  const { accessToken, logout } = useAuth();
  useRequireAuth('/admin/login');

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [passwordModal, setPasswordModal] = useState({ open: false, adminId: null, newPassword: '' });

  // Load admin users
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const res = await api.get('/admin/users', { headers });
      setAdmins(res.data.users);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else toast.error(err.response?.data?.error || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Create new admin
  const handleCreate = async () => {
    const { name, email, password } = newAdmin;
    if (!name || !email || !password) return toast.error('All fields required');
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      await api.post('/admin-register', { name, email, password }, { headers });
      toast.success('Admin created');
      setShowCreate(false);
      setNewAdmin({ name: '', email: '', password: '' });
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Creation failed');
    }
  };

  // Delete admin
  const handleDelete = async id => {
    if (!window.confirm('Delete this admin?')) return;
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      await api.delete(`/admin/users/${id}`, { headers });
      toast.success('Admin deleted');
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deletion failed');
    }
  };

  // Password change
  const openPass = id => setPasswordModal({ open: true, adminId: id, newPassword: '' });
  const closePass = () => setPasswordModal({ open: false, adminId: null, newPassword: '' });

  const changePassword = async () => {
    const { adminId, newPassword } = passwordModal;
    if (!newPassword) return toast.error('Password required');
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      await api.put(`/admin/users/${adminId}/password`, { password: newPassword }, { headers });
      toast.success('Password updated');
      closePass();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Admin Users</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          <PlusCircle size={20} className="mr-2" /> New Admin
        </button>
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
                {['ID', 'Name', 'Email', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!admins.length ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">No admins found</td>
                </tr>
              ) : (
                admins.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{a.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{a.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{a.email}</td>
                    <td className="px-4 py-3 flex space-x-2">
                      <button onClick={() => openPass(a.id)} className="p-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">
                        <Key size={16} />
                      </button>
                      {a.id !== 1 && (
                        <button onClick={() => handleDelete(a.id)} className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Create Admin</h3>
            <input placeholder="Name" value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} className="w-full mb-2 p-2 border rounded" />
            <input placeholder="Email" type="email" value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} className="w-full mb-2 p-2 border rounded" />
            <input placeholder="Password" type="password" value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} className="w-full mb-4 p-2 border rounded" />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <input placeholder="New Password" type="password" value={passwordModal.newPassword} onChange={e => setPasswordModal({ ...passwordModal, newPassword: e.target.value })} className="w-full mb-4 p-2 border rounded" />
            <div className="flex justify-end space-x-2">
              <button onClick={closePass} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={changePassword} className="px-4 py-2 bg-yellow-600 text-white rounded">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}