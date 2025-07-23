// src/App.jsx
import React from 'react';
import { ToastContainer } from 'react-toastify';
import AppRoutes from './AppRoutes';
import useAutoSession from './hooks/useAutoSession';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  // Enable auto-session for both admin & investor
  useAutoSession();

  return (
    <>
      {/* Global Toasts */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      {/* Your routing tree */}
      <AppRoutes />
    </>
  );
}

