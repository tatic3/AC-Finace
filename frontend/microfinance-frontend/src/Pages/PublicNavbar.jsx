import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function PublicNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Home',           path: '/' },
    { name: 'About',          path: '/about' },
    { name: 'Contact',        path: '/contact' },
    { name: 'Admin Login',    path: '/admin/login' },
    { name: 'Investor Login', path: '/investor/login' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 fixed top-0 w-full z-50">
      {/* same max-width & height as minimal test */}
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-blue-600">
          AC Finance
        </Link>

        {/* Always-visible inline links */}
        <div className="flex items-center space-x-6">
          {navLinks.map(link => (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `text-sm font-medium transition ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-700 hover:text-blue-600'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </div>

        {/* Always-visible hamburger */}
        <button
          onClick={() => setIsOpen(o => !o)}
          aria-label="Toggle menu"
          className="text-gray-700 hover:text-blue-600 focus:outline-none"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Dropdown below, same minimal padding */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="nav-dropdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white shadow-md border-t"
          >
            <div className="px-4 py-2 space-y-1">
              {navLinks.map(link => (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block text-sm font-medium transition ${
                      isActive
                        ? 'text-blue-600'
                        : 'text-gray-700 hover:text-blue-600'
                    }`
                  }
                >
                  {link.name}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
