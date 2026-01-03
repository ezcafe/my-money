/**
 * Login Page
 * Initiates OIDC authentication flow
 */

import React, {useState} from 'react';
import {Box, Typography, CardContent, TextField, Link, Stack, Card} from '@mui/material';
import {AccountBalance} from '@mui/icons-material';
import {useNavigate} from 'react-router';
import {Button} from '../components/ui/Button';
import {initiateLogin} from '../utils/oidc';
import {devLogin} from '../utils/devLogin';
import {ErrorAlert} from '../components/common/ErrorAlert';

/**
 * Login Page Component
 * Displays login UI and initiates OIDC authentication flow
 */
export function LoginPage(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [username, setUsername] = useState(
    process.env.REACT_APP_DEV_USERNAME ?? '',
  );
  const [password, setPassword] = useState(
    process.env.REACT_APP_DEV_PASSWORD ?? '',
  );
  const [devLoginLoading, setDevLoginLoading] = useState(false);
  const navigate = useNavigate();
  const enableDevLogin = `${process.env.REACT_APP_ENABLE_DEV_LOGIN}` === 'true';

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

  /**
   * Handle dev login form submission
   */
  const handleDevLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setDevLoginLoading(true);

    try {
      await devLogin(username, password);
      // Redirect to home page on success
      void navigate('/', {replace: true});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Dev login failed';
      setError(errorMessage);
      setDevLoginLoading(false);
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
      <Card sx={{width: '100%', maxWidth: 420}}>
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
              <AccountBalance sx={{fontSize: 48}} />
            </Box>

            <Typography variant="h4" component="h1" align="center" fontWeight={600}>
              My Money
            </Typography>

            <Typography variant="body1" align="center" color="text.secondary">
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

            {!showDevLogin ? (
              <Stack spacing={2} sx={{width: '100%', mt: 2}}>
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

                {enableDevLogin && (
                  <Box sx={{width: '100%', textAlign: 'center'}}>
                    <Link
                      component="button"
                      variant="body2"
                      onClick={() => {
                        setShowDevLogin(true);
                      }}
                      sx={{
                        cursor: 'pointer',
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      Development Login
                    </Link>
                  </Box>
                )}
              </Stack>
            ) : (
              <Box
                component="form"
                onSubmit={(e) => {
                  void handleDevLogin(e);
                }}
                sx={{width: '100%', mt: 2}}
              >
                <Stack spacing={2}>
                  <TextField
                    label="Username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                    }}
                    required
                    fullWidth
                    disabled={devLoginLoading}
                    autoComplete="username"
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    required
                    fullWidth
                    disabled={devLoginLoading}
                    autoComplete="current-password"
                  />
                  <Stack direction="row" spacing={2}>
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      disabled={devLoginLoading}
                      size="large"
                    >
                      {devLoginLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => {
                        setShowDevLogin(false);
                        setError(null);
                      }}
                      disabled={devLoginLoading}
                      size="large"
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

