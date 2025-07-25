import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './PublicNavbar.css';

export default function PublicNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
    { name: 'Admin Login', path: '/admin/login' },
    { name: 'Investor Login', path: '/investor/login' },
  ];

  return (
    <>
      {/* Navbar Bar */}
      <nav className="navbar">
        <div className="navbar-logo">AC Finance</div>
        {!isMobile && (
          <ul className="desktop-nav-links">
            {navLinks.map(link => (
              <li key={link.name}>
                <NavLink to={link.path} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
        {isMobile && (
          <button className="menu-btn" onClick={() => setIsOpen(o => !o)}>
            <i className={isOpen ? 'fas fa-times' : 'fas fa-bars'} />
          </button>
        )}
      </nav>

      {/* Mobile Fullscreen Overlay */}
      {isMobile && (
        <div className={`wrapper ${isOpen ? 'active' : ''}`}>  
          <ul>
            {navLinks.map(link => (
              <li key={link.name}>
                <NavLink
                  to={link.path}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
