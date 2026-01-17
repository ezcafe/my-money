/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 * Enhanced with error recovery mechanisms and error reporting
 */

import React, {Component, type ReactNode} from 'react';
import {ErrorPage} from './ErrorPage';
import {showErrorNotification} from '../../utils/errorNotification';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional error handler for custom error reporting */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Component name for error reporting */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Enhanced with error recovery mechanisms and structured error reporting
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Store error info for reporting
    this.setState({errorInfo});

    // Log error with structured information
    const errorContext = {
      componentName: this.props.componentName ?? 'Unknown',
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
    };

    console.error('Error caught by boundary:', errorContext);

    // Report error to custom handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (reportingError) {
        console.error('Error in error reporting handler:', reportingError);
      }
    }

    // Show user-friendly error notification
    const userMessage = this.props.errorMessage ?? 
      `An error occurred in ${this.props.componentName ?? 'this component'}. Please try again.`;
    
    showErrorNotification(userMessage, {
      originalError: error.message,
      code: 'COMPONENT_ERROR',
      retryable: true,
      componentName: this.props.componentName,
    });
  }

  componentWillUnmount(): void {
    // Clear any pending retry timeouts
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  /**
   * Handle reset with exponential backoff retry
   */
  handleReset = (): void => {
    const {retryCount} = this.state;
    const maxRetries = 3;

    if (retryCount >= maxRetries) {
      // Reset to initial state after max retries
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: 0,
      });
      return;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount) * 1000;

    this.retryTimeoutId = setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
      this.retryTimeoutId = null;
    }, delay);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.props.errorMessage ?? 
        this.state.error?.message ?? 
        'An unexpected error occurred.';

      return (
        <ErrorPage
          errorMessage={errorMessage}
          onReset={this.handleReset}
          showResetButton={this.props.showRetry !== false}
          isApplicationDown={false}
        />
      );
    }

    return this.props.children;
  }
}

