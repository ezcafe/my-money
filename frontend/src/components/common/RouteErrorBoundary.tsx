/**
 * Route Error Boundary Component
 * Wraps routes to catch errors and prevent entire app from crashing
 */

import React from 'react';
import {ErrorBoundary} from './ErrorBoundary';
import {ErrorPage} from './ErrorPage';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Route Error Boundary Component
 * Provides error isolation for individual routes
 */
export function RouteErrorBoundary({children}: RouteErrorBoundaryProps): React.JSX.Element {
  return (
    <ErrorBoundary
      fallback={<ErrorPage />}
    >
      {children}
    </ErrorBoundary>
  );
}







