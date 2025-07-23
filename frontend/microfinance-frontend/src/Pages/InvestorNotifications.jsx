// src/Pages/InvestorNotifications.jsx
import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, CheckCircle, Bell } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/AuthContext.jsx';
import useRequireAuth from '../hooks/useRequireAuth.js';
import { motion, AnimatePresence } from 'framer-motion';

export default function InvestorNotifications() {
  useRequireAuth('/investor/login');
  const { accessToken, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!accessToken) return setLoading(false);
      setLoading(true);
      try {
        const res = await api.get('/investor/notifications', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const raw = Array.isArray(res.data) ? res.data : res.data.notifications || [];
        const sorted = raw.slice().sort((a, b) => {
          if (a.read !== b.read) return a.read ? 1 : -1;
          const da = new Date(a.created_at ?? a.date);
          const db = new Date(b.created_at ?? b.date);
          return db - da;
        });
        setNotifications(sorted);
      } catch (err) {
        if (err.response?.status === 401) {
          toast.error('Session expired');
          logout();
        } else if (err.response?.status === 404) {
          toast.error('Notifications endpoint not found.');
        } else {
          toast.error('Failed to load notifications');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [accessToken, logout]);

  const markAsRead = async (id) => {
    try {
      await api.post(
        '/investor/notifications/read',
        { id },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setNotifications(ns =>
        ns.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Mark-as-read endpoint not found.');
      } else {
        toast.error('Failed to mark as read');
      }
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post(
        '/investor/notifications/read-all',
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Mark-all-read endpoint not found.');
      } else {
        toast.error('Failed to mark all as read');
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const anyUnread = notifications.some(n => !n.read);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold flex items-center">
          <Bell className="mr-2 text-gray-600" /> Notifications
        </h2>
        <button
          type="button"
          onClick={markAllRead}
          disabled={markingAll || !anyUnread}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {markingAll ? <Loader2 className="animate-spin" /> : 'Mark all read'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <Loader2 className="animate-spin mx-auto text-3xl text-gray-500" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-center text-gray-500">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence>
            {notifications.map(n => {
              const ts = n.created_at ?? n.date;
              const date = new Date(ts);
              const dateStr = isNaN(date) ? '—' : date.toLocaleString();

              return (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, margin: 0, padding: 0 }}
                  className={`p-4 border rounded-lg flex justify-between items-start transition-colors ${
                    n.read ? 'bg-gray-50' : 'bg-white shadow-md'
                  }`}
                >
                  <div>
                    <p className="text-sm mb-1">{n.message}</p>
                    <p className="text-xs text-gray-400">{dateStr}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="text-green-600 hover:text-green-800 p-1 rounded"
                      title="Mark as read"
                    >
                      <CheckCircle />
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
