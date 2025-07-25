// src/Layouts/InvestorLayout.jsx
import React, { useEffect, useState, createContext, useContext } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  ClipboardList,
  DollarSign,
  LogOut,
  Bell,
  UserCircle,
  Menu
} from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';
import './InvestorLayout.css';

// Optional theme context
export const ThemeContext = createContext({ overlayBg: '#5fb5ca' });

export function ThemeProvider({ children, theme }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export default function InvestorLayout() {
  const navigate = useNavigate();
  const { accessToken, logout, user } = useAuth();
  useRequireAuth('/investor/login');

  const [notifications, setNotifications] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    if (!accessToken) return;
    api
      .get('/investor/notifications', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then(res => setNotifications(res.data.notifications || []))
      .catch(err => {
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
    { to: '/investor/dashboard',    icon: Home,         label: 'Dashboard' },
    { to: '/investor/invest',       icon: DollarSign,   label: 'Invest' },
    { to: '/investor/loans',        icon: ClipboardList,label: 'Loans' },
    { to: '/investor/repayments',   icon: DollarSign,   label: 'Repayments' },
    { to: '/investor/withdrawals',  icon: ClipboardList,label: 'Withdrawals' },
    { to: '/investor/notifications',icon: Bell,         label: 'Notifications' },
    { action: handleLogout,         icon: LogOut,       label: 'Logout' }
  ];

  return (
    <div className="investor-layout">
      {/* menu toggle */}
      <button
        className="menu-btn"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen(o => !o)}
      >
        <Menu size={28} />
      </button>

      {/* overlay */}
      <div
        className={`overlay-wrapper${menuOpen ? ' open' : ''}`}
        style={{ background: theme.overlayBg }}
      >
        <ul>
          {navItems.map((item, idx) =>
            item.to ? (
              <li key={idx}>
                <NavLink
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => isActive ? 'active-link' : ''}
                >
                  <item.icon className="icon" />
                  {item.label}
                </NavLink>
              </li>
            ) : (
              <li key={idx}>
                <button
                  onClick={() => { item.action(); setMenuOpen(false); }}
                  className="logout-btn"
                >
                  <item.icon className="icon" />
                  {item.label}
                </button>
              </li>
            )
          )}
        </ul>
      </div>

      {/* header & content */}
      <div className="content-area">
        <header className="header">
          <div className="header-info left">
            <UserCircle size={64} className="profile-icon" />
            <div className="text-block">
              <span className="title">{user?.full_name || 'Investor Name'}</span>
              <span className="subtitle">AC Finance</span>
              <span className="username">{user?.email || ''}</span>
            </div>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}