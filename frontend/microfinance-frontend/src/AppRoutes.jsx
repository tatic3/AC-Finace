// src/AppRoutes.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Pages
import PublicLayout from './Pages/PublicLayout';
import InvestorLayout from './Pages/InvestorLayout';
import AdminLayout from './Pages/AdminLayout';

import Home from './Pages/Home';
import About from './Pages/About';
import Contact from './Pages/Contact';
import InvestorLogin from './Pages/InvestorLogin';
import InvestorRegister from './Pages/InvestorRegister';
import InvestorForgotPassword from './Pages/InvestorForgotPassword';
import AdminLogin from './Pages/AdminLogin';

import InvestorDashboard from './Pages/InvestorDashboard';
import InvestorInvest from './Pages/InvestorInvest';
import InvestorLoans from './Pages/InvestorLoans';
import InvestorRepayments from './Pages/InvestorRepayments';
import InvestorWithdrawals from './Pages/InvestorWithdrawals';
import InvestorNotifications from './Pages/InvestorNotifications';

import AdminDashboard from './Pages/AdminDashboard';
import AdminManagement from './Pages/AdminManagement';
import AuditLogs from './Pages/AuditLogs';
import AdminInvestors from './Pages/AdminInvestors';
import AdminInvestments from './Pages/AdminInvestments';
import AdminLoans from './Pages/AdminLoans';
import AdminWithdrawals from './Pages/AdminWithdrawals';
import AdminRepayments from './Pages/AdminRepayments';

// ThemeProvider for dynamic sidebar theming
import { ThemeProvider } from './Pages/InvestorLayout';

export default function AppRoutes() {
  // Define your custom theme palette
  const customTheme = {
    sidebarGradient: 'from-blue-500 via-blue-600 to-blue-700',
    sidebarText: 'text-white',
    sidebarActiveBg: 'bg-white',
    sidebarActiveText: 'text-blue-600',
    sidebarHoverBg: 'hover:bg-blue-500/30',
    mainBg: 'bg-gray-50',
    headerBg: 'bg-white',
  };

  return (
    <ThemeProvider theme={customTheme}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="investor/login" element={<InvestorLogin />} />
          <Route path="investor/register" element={<InvestorRegister />} />
          <Route path="investor/forgot-password" element={<InvestorForgotPassword />} />
          <Route path="admin/login" element={<AdminLogin />} />
        </Route>

        {/* Investor protected */}
        <Route path="/investor/*" element={<InvestorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<InvestorDashboard />} />
          <Route path="invest" element={<InvestorInvest />} />
          <Route path="loans" element={<InvestorLoans />} />
          <Route path="repayments" element={<InvestorRepayments />} />
          <Route path="withdrawals" element={<InvestorWithdrawals />} />
          <Route path="notifications" element={<InvestorNotifications />} />
        </Route>

        {/* Admin protected */}
        <Route path="/admin/*" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminManagement />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="investors" element={<AdminInvestors />} />
          <Route path="investments" element={<AdminInvestments />} />
          <Route path="loans" element={<AdminLoans />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="repayments" element={<AdminRepayments />} />
        </Route>

        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
