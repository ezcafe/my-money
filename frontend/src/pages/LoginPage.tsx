/**
 * Login Page
 * Initiates OIDC authentication flow
 */

import React, {useState} from 'react';
import {Box, Typography} from '@mui/material';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {initiateLogin} from '../utils/oidc';
import {ErrorAlert} from '../components/common/ErrorAlert';

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
        padding: 2,
        backgroundColor: 'background.default',
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          padding: 4,
        }}
      >
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          My Money
        </Typography>
        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{marginBottom: 3}}
        >
          Sign in to manage your expenses
        </Typography>

        {error && (
          <ErrorAlert
            message={error}
            onClose={() => {
              setError(null);
            }}
          />
        )}

        <Button
          onClick={handleLogin}
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{marginTop: 2}}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </Card>
    </Box>
  );
}

