/**
 * OIDC Callback Handler
 * Processes OIDC redirect and exchanges authorization code for tokens
 */

import React, {useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {Box, Typography} from '@mui/material';
import {handleCallback} from '../utils/oidc';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {Button} from '../components/ui/Button';

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

      if (!code || !state) {
        setError('Missing authorization code or state parameter');
        setLoading(false);
        return;
      }

      const success = await handleCallback(code, state);
      setLoading(false);

      if (success) {
        // Redirect to home page
        void navigate('/', {replace: true});
      } else {
        setError('Failed to exchange authorization code for tokens. Please try again.');
      }
    };

    void processCallback();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          width: '100%',
          maxWidth: '100vw',
          margin: 0,
        }}
      >
        <LoadingSpinner message="Completing authentication..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: 2,
          width: '100%',
          maxWidth: '100vw',
          margin: 0,
        }}
      >
        <Box sx={{width: '100%', maxWidth: 500}}>
          <Typography variant="h5" component="h2" gutterBottom>
            Authentication Error
          </Typography>
          <ErrorAlert message={error} />
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              void navigate('/login');
            }}
            sx={{marginTop: 2}}
          >
            Return to Login
          </Button>
        </Box>
      </Box>
    );
  }

  // This should not be reached, but return a loading state just in case
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <LoadingSpinner message="Redirecting..." />
    </Box>
  );
}

