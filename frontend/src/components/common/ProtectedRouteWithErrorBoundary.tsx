/**
 * Protected Route with Error Boundary
 * Combines authentication protection with error boundary for route isolation
 */

import React from 'react';
import {ProtectedRoute} from './ProtectedRoute';
import {RouteErrorBoundary} from './RouteErrorBoundary';

interface ProtectedRouteWithErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Protected Route with Error Boundary Component
 * Wraps routes with both authentication protection and error boundary
 */
export function ProtectedRouteWithErrorBoundary({
  children,
}: ProtectedRouteWithErrorBoundaryProps): React.JSX.Element {
  return (
    <ProtectedRoute>
      <RouteErrorBoundary>{children}</RouteErrorBoundary>
    </ProtectedRoute>
  );
}







