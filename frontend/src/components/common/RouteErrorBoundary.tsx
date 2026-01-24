/**
 * Route Error Boundary Component
 * Wraps routes to catch errors and prevent entire app from crashing
 * Enhanced with route-specific error handling
 */

import React from 'react';
import { useLocation } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorPage } from './ErrorPage';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Route Error Boundary Component
 * Provides error isolation for individual routes
 * Enhanced with route-specific error reporting and recovery
 */
export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps): React.JSX.Element {
  const location = useLocation();

  const handleError = (error: Error, errorInfo: React.ErrorInfo): void => {
    // Log route-specific errors with route information
    console.error('Route error:', {
      route: location.pathname,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <ErrorBoundary
      componentName={`Route: ${location.pathname}`}
      onError={handleError}
      showRetry
      fallback={<ErrorPage />}
    >
      {children}
    </ErrorBoundary>
  );
}
