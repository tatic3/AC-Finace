// src/Pages/AdminProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext.jsx';

/**
 * Guards admin routes: renders children if authenticated,
 * otherwise redirects to login.
 */
export default function AdminProtectedRoute({ children }) {
  const { accessToken } = useAuth();

  // While auth state is initializing, you might show null or a spinner
  if (accessToken === null) return null;

  return accessToken ? children : <Navigate to="/admin/login" replace />;
}
