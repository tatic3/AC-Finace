// src/hooks/useRequireAuth.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Redirects to login if no accessToken found.
 * Use in protected components:
 *   useRequireAuth('/investor/login');
 */
export default function useRequireAuth(redirectPath = '/login') {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!accessToken) {
      navigate(redirectPath, { replace: true });
    }
  }, [accessToken, navigate, redirectPath]);
}
