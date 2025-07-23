import React from 'react';

/**
 * Simple Card component for consistent UI layout.
 * Usage:
 * <Card><CardContent>...</CardContent></Card>
 */
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {children}
    </div>
  );
}
