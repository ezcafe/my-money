/**
 * Login Page
 * Initiates OIDC authentication flow
 */

import React, {useState} from 'react';
import {Box, Typography, CardContent} from '@mui/material';
import {AccountBalance} from '@mui/icons-material';
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
        backgroundColor: 'background.default',
        padding: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          boxShadow: 3,
          borderRadius: 3,
        }}
      >
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 4,
            gap: 3,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              marginBottom: 1,
            }}
          >
            <AccountBalance sx={{fontSize: 48}} />
          </Box>

          <Typography
            variant="h4"
            component="h1"
            align="center"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            My Money
          </Typography>

          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{
              marginBottom: 1,
            }}
          >
            Sign in to manage your expenses
          </Typography>

          {error && (
            <Box sx={{width: '100%'}}>
              <ErrorAlert
                message={error}
                onClose={() => {
                  setError(null);
                }}
              />
            </Box>
          )}

          <Button
            onClick={() => {
              void handleLogin();
            }}
            variant="contained"
            fullWidth
            disabled={loading}
            size="large"
            sx={{
              marginTop: 2,
              padding: 1.5,
              fontSize: '1rem',
              fontWeight: 500,
              textTransform: 'none',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

