// src/hooks/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

/**
 * AuthProvider wraps your app and manages accessToken in state & localStorage.
 * It syncs axios Authorization header and exposes setAccessToken & logout.
 */
export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() =>
    localStorage.getItem('accessToken')
  );

  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      localStorage.setItem('accessToken', accessToken);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('accessToken');
    }
  }, [accessToken]);

  const logout = () => {
    setAccessToken(null);
    // optionally call backend logout endpoint here
  };

  return (
    <AuthContext.Provider value={{ accessToken, setAccessToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook gives access to auth context for login, logout, token.
 */
export function useAuth() {
  return useContext(AuthContext);
}