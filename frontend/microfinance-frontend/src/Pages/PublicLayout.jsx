import React from 'react';
import { Outlet } from 'react-router-dom';
import PublicNavbar from '../Pages/PublicNavbar';

export default function PublicLayout() {
  return (
    <>
      <PublicNavbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}
