// src/hooks/useAutoSession.js
import { useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

/**
 * Automatically renews access token every INTERVAL if user is active,
 * otherwise logs out after inactivity.
 */
export default function useAutoSession() {
  const { accessToken, logout, setAccessToken } = useAuth();
  const lastActivity = useRef(Date.now());
  const INTERVAL = 10 * 60 * 1000; // 10 minutes

  // track user activity
  useEffect(() => {
    const reset = () => { lastActivity.current = Date.now(); };
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt =>
      window.addEventListener(evt, reset)
    );
    return () => {
      ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt =>
        window.removeEventListener(evt, reset)
      );
    };
  }, []);

  // set up interval to refresh token
  useEffect(() => {
    if (!accessToken) return;
    const timer = setInterval(async () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= INTERVAL) {
        logout();
      } else {
        try {
          const { data } = await api.post('/auth/refresh');
          setAccessToken(data.access_token);
        } catch {
          logout();
        }
      }
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [accessToken, logout, setAccessToken]);
}
