/**
 * Route Error Boundary Component
 * Wraps routes to catch errors and prevent entire app from crashing
 */

import React from 'react';
import {ErrorBoundary} from './ErrorBoundary';

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
      fallback={
        <div style={{padding: '20px', textAlign: 'center'}}>
          <h2>Something went wrong on this page</h2>
          <p>Please try refreshing the page or navigating away.</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}



