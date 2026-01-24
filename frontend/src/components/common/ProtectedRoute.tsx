/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */

import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.JSX.Element;
}

/**
 * Protected Route Component
 * Wraps routes that require authentication
 * Redirects to login page if user is not authenticated
 * @param children - Child component to render if authenticated
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): React.JSX.Element {
  const { isAuthenticated: authenticated, checkAuth } = useAuth();
  const navigate = useNavigate();

  // Re-check auth when component mounts
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authenticated === false) {
      void navigate('/login', { replace: true });
    }
  }, [authenticated, navigate]);

  if (authenticated === null) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (authenticated === false) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
