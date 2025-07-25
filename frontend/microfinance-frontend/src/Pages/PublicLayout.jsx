import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicNavbar from '../Pages/PublicNavbar';
import './PublicLayout.css';

export default function PublicLayout() {
  return (
    <div className="public-wrapper">
      <PublicNavbar />
      <main className="public-main">
        <Outlet />
      </main>
    </div>
  );
}
