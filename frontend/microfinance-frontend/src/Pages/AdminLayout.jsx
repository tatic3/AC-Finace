import React, { useState, useContext, createContext } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  DollarSign,
  Repeat,
  ClipboardList,
  LogOut,
  UserCircle,
  Menu
} from 'lucide-react';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';
import './AdminLayout.css';

// Optional theme context
export const ThemeContext = createContext({ overlayBg: '#000' });

export default function AdminLayout() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  useRequireAuth('/admin/login');

  // Decode token for name/role
  let sub = '', name = 'Admin';
  try {
    const [, payload] = accessToken.split('.');
    const decoded = JSON.parse(atob(payload));
    sub  = decoded.sub;
    name = decoded.name || decoded.email || 'Admin';
  } catch {}

  const isSuperAdmin = sub === '1';
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useContext(ThemeContext);

  const navItems = [
    { to: '/admin/dashboard',    icon: Home,         label: 'Dashboard' },
    ...(isSuperAdmin
      ? [
          { to: '/admin/users',      icon: Users,        label: 'Users' },
          { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
        ]
      : []),
    { to: '/admin/investors',    icon: Users,        label: 'Investors' },
    { to: '/admin/investments',  icon: DollarSign,   label: 'Investments' },
    { to: '/admin/loans',        icon: FileText,     label: 'Loans' },
    { to: '/admin/repayments',   icon: Repeat,       label: 'Repayments' },
    { to: '/admin/withdrawals',  icon: FileText,     label: 'Withdrawals' },
    {
      action: () => {
        logout();
        navigate('/admin/login', { replace: true });
      },
      icon: LogOut,
      label: 'Logout'
    }
  ];

  return (
    <div className="admin-layout">
      {/* Menu Toggle Button */}
      <button
        className="menu-btn"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen(open => !open)}
      >
        <Menu size={28} />
      </button>

      {/* Overlay Menu */}
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
                  className={({ isActive }) => (isActive ? 'active-link' : '')}
                >
                  <item.icon className="icon" />
                  {item.label}
                </NavLink>
              </li>
            ) : (
              <li key={idx}>
                <button
                  onClick={() => {
                    item.action();
                    setMenuOpen(false);
                  }}
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

      {/* Header & Main Content */}
      <div className="content-area">
        <header className="header">
          <div className="header-info left">
            <UserCircle size={64} className="profile-icon" />
            <div className="text-block">
              <span className="title">AC Finance</span>
              <span className="subtitle">{isSuperAdmin ? 'SuperAdmin' : 'Admin'}</span>
              <span className="username">{name}</span>
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
