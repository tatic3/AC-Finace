// src/Pages/InvestorLayout.jsx

import React, { useEffect, useState, createContext, useContext } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, DollarSign, LogOut } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';

// Theme context for dynamic colors
const ThemeContext = createContext({
  sidebarGradient: 'from-blue-500 via-blue-600 to-blue-700',
  sidebarText: 'text-white',
  sidebarActiveBg: 'bg-white',
  sidebarActiveText: 'text-blue-600',
  sidebarHoverBg: 'hover:bg-blue-500/30',
  mainBg: 'bg-gray-50',
  headerBg: 'bg-white',
});

export function ThemeProvider({ children, theme }) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export default function InvestorLayout() {
  const navigate = useNavigate();
  const { accessToken, logout, user } = useAuth();
  useRequireAuth('/investor/login');

  const [notifications, setNotifications] = useState([]);
  const [hasNew, setHasNew] = useState(false);

  const theme = useContext(ThemeContext);

  useEffect(() => {
    if (!accessToken) return;
    api.get('/investor/notifications', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(res => {
        setNotifications(res.data.notifications || []);
        setHasNew((res.data.notifications?.length || 0) > 0);
      })
      .catch(err => {
        console.error('Notifications load error', err);
        if (err.response?.status === 401) {
          toast.error('Session expired');
          logout();
        } else {
          toast.error('Failed to load notifications');
        }
      });
  }, [accessToken, logout]);

  const handleLogout = () => {
    logout();
    navigate('/investor/login', { replace: true });
  };

  const navItems = [
    { to: '/investor/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/investor/invest', icon: DollarSign, label: 'Invest' },
    { to: '/investor/loans', icon: ClipboardList, label: 'Loans' },
    { to: '/investor/repayments', icon: DollarSign, label: 'Repayments' },
    { to: '/investor/withdrawals', icon: ClipboardList, label: 'Withdrawals' },
    { to: '/investor/notifications', icon: ClipboardList, label: 'Notifications' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`w-80 flex flex-col shadow-xl bg-gradient-to-b ${theme.sidebarGradient} ${theme.sidebarText}`}
      >
        {/* Profile Section */}
        <div className="py-12 flex flex-col items-center border-b border-white/20">
          <img
            src="/profile_blur_rounded.png"
            alt="Investor"
            className="w-40 h-40 object-cover rounded-lg border-4 border-white shadow-lg"
          />
          <h2 className="mt-6 text-2xl font-semibold">{user?.full_name || 'Investor Name'}</h2>
          <p className="text-sm opacity-80">AC Finance</p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 mt-12 px-6 space-y-8">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/investor/dashboard'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-6 px-8 py-6 rounded-xl transition-all duration-300',
                  isActive
                    ? `${theme.sidebarActiveBg} ${theme.sidebarActiveText} shadow-xl`
                    : `${theme.sidebarHoverBg}`
                ].join(' ')
              }
            >
              <Icon className="w-6 h-6" />
              <span className="text-2xl font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-6 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-4 px-8 py-5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-xl font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`${theme.mainBg} flex-1 flex flex-col`}>
        {/* Header (empty) */}
        <header className={`${theme.headerBg} border-b border-gray-200 px-6 py-4`} />

        {/* Page Content */}
        <main className="flex-1 p-10 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
