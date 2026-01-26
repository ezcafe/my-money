/**
 * Login Page
 * Initiates OIDC authentication flow
 */

import React, { useState } from 'react';
import { Box, Typography, CardContent, Stack, Card } from '@mui/material';
import { AccountBalance } from '@mui/icons-material';
import { Button } from '../components/ui/Button';
import { initiateLogin } from '../utils/oidc';
import { ErrorAlert } from '../components/common/ErrorAlert';

/**
 * Login Page Component
 * Displays login UI and initiates OIDC authentication flow
 */
export function LoginPage(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handle login button click
   * Initiates OIDC authentication flow
   */
  const handleLogin = async (): Promise<void> => {
    setError(null);
    setLoading(true);

    try {
      await initiateLogin();
      // Note: initiateLogin() redirects, so this code may not execute
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start login process';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent>
          <Stack spacing={3} alignItems="center">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <AccountBalance sx={{ fontSize: 48 }} />
            </Box>

            <Typography variant="h4" component="h1" align="center" fontWeight={600}>
              My Money
            </Typography>

            <Typography variant="body1" align="center" color="text.secondary">
              Sign in to manage your transactions
            </Typography>

            {error ? (
              <Box sx={{ width: '100%' }}>
                <ErrorAlert
                  message={error}
                  onClose={() => {
                    setError(null);
                  }}
                />
              </Box>
            ) : null}

            <Stack spacing={2} sx={{ width: '100%', mt: 2 }}>
              <Button
                onClick={() => {
                  void handleLogin();
                }}
                variant="contained"
                fullWidth
                disabled={loading}
                size="large"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
