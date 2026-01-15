/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */

import React, {useState, useEffect} from 'react';
import {Navigate} from 'react-router';
import {isAuthenticated} from '../../utils/oidc';
import {LoadingSpinner} from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.JSX.Element;
}

/**
 * Protected Route Component
 * Wraps routes that require authentication
 * Redirects to login page if user is not authenticated
 * @param children - Child component to render if authenticated
 */
export function ProtectedRoute({children}: ProtectedRouteProps): React.JSX.Element {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    void isAuthenticated().then((isAuth) => {
      setAuthenticated(isAuth);
    });
  }, []);

  // Monitor visibility changes to re-check auth when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (!document.hidden && authenticated === true) {
        void isAuthenticated().then((isAuth) => {
          setAuthenticated(isAuth);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authenticated]);

  if (authenticated === null) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

