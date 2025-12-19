/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */

import React from 'react';
import {Navigate} from 'react-router';
import {isAuthenticated} from '../../utils/oidc';

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
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

