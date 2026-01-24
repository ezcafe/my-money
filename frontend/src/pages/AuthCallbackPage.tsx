/**
 * OIDC Callback Handler
 * Processes OIDC redirect and exchanges authorization code for tokens
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Typography, Stack } from '@mui/material';
import { handleCallback } from '../utils/oidc';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Button } from '../components/ui/Button';

/**
 * Auth Callback Page Component
 * Handles OIDC callback and token exchange
 */
export function AuthCallbackPage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * Process OIDC callback
     */
    const processCallback = async (): Promise<void> => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        const errorMessage = errorDescription ?? `Authentication failed: ${errorParam}`;
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Check if this is a success redirect from backend
      const successParam = searchParams.get('success');
      if (successParam === 'true') {
        // Validate state for CSRF protection
        const state = searchParams.get('state');
        const storedState = sessionStorage.getItem('oidc_state');

        if (state && storedState && state === storedState) {
          // State matches, clear it and redirect to home
          sessionStorage.removeItem('oidc_state');
          setLoading(false);
          void navigate('/', { replace: true });
          return;
        } else if (!state || !storedState) {
          // Missing state - might be a direct visit or session expired
          setError('Authentication state validation failed. Please try logging in again.');
          setLoading(false);
          return;
        } else {
          // State mismatch - possible CSRF attack
          setError('Invalid authentication state. Please try logging in again.');
          setLoading(false);
          return;
        }
      }

      if (!code || !state) {
        setError('Missing authorization code or state parameter');
        setLoading(false);
        return;
      }

      // Redirect to backend callback endpoint
      await handleCallback(code, state);
      // handleCallback will redirect to backend, so we won't reach here
      // But set loading to false just in case
      setLoading(false);
    };

    void processCallback();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ minHeight: '100vh' }}>
        <LoadingSpinner message="Completing authentication..." />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack justifyContent="center" alignItems="center" sx={{ minHeight: '100vh' }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            Authentication Error
          </Typography>
          <ErrorAlert message={error} />
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              void navigate('/login');
            }}
          >
            Return to Login
          </Button>
        </Stack>
      </Stack>
    );
  }

  // This should not be reached, but return a loading state just in case
  return (
    <Stack justifyContent="center" alignItems="center" sx={{ minHeight: '100vh' }}>
      <LoadingSpinner message="Redirecting..." />
    </Stack>
  );
}
