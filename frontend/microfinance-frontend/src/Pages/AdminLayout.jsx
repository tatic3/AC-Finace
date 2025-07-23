// src/Layouts/AdminLayout.jsx
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  DollarSign,
  Repeat,
  ClipboardList,
  LogOut,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

export default function AdminLayout() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  useRequireAuth('/admin/login');

  // decode sub and any custom claim 'role' or 'email'
  let sub = '', name = 'Admin';
  try {
    const [, payload] = accessToken.split('.');
    const decoded = JSON.parse(atob(payload));
    sub  = decoded.sub;
    name = decoded.name || decoded.email || 'Admin';
  } catch {}

  const isSuperAdmin = sub === '1';

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <Home size={18}/> },
    ...(isSuperAdmin ? [
      { name: 'Users', path: '/admin/users',     icon: <Users size={18}/> },
      { name: 'Audit Logs', path: '/admin/audit-logs', icon: <ClipboardList size={18}/> },
    ] : []),
    { name: 'Investors',   path: '/admin/investors', icon: <Users size={18}/> },
    { name: 'Investments', path: '/admin/investments', icon: <DollarSign size={18}/> },
    { name: 'Loans',       path: '/admin/loans',       icon: <FileText size={18}/> },
    { name: 'Repayments',  path: '/admin/repayments',  icon: <Repeat size={18}/> },
    { name: 'Withdrawals', path: '/admin/withdrawals', icon: <FileText size={18}/> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="h-16 flex items-center justify-center border-b">
          <span className="text-2xl font-bold text-blue-600">Admin Panel</span>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin/dashboard'}
              className={({ isActive }) =>
                `flex items-center p-2 rounded hover:bg-gray-100 ${isActive ? 'bg-gray-200' : ''}`
              }
            >
              {item.icon}<span className="ml-2">{item.name}</span>
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="m-4 flex items-center px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600"
        >
          <LogOut className="mr-2"/><span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="flex justify-end items-center bg-white border-b p-4">
          <div className="flex items-center space-x-3">
            <div className="flex flex-col items-end text-right">
              <span className="text-xl font-bold text-blue-700">AC Finance</span>
              <span className="text-sm text-gray-600">{isSuperAdmin ? 'SuperAdmin' : 'Admin'}</span>
              <span className="text-xs text-gray-500 truncate max-w-[150px]">{name}</span>
            </div>
            <UserCircle size={48} className="text-gray-600"/>
          </div>
        </header>
        <main className="flex-1 bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
);
}
