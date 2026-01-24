/**
 * Error Page Component
 * Reusable error page component for displaying error messages
 * Uses Layout and PageContainer for consistent styling with other pages
 */

import React from 'react';
import { Typography, Button, Stack } from '@mui/material';
import { Card } from '../ui/Card';
import { Layout } from './Layout';
import { PageContainer } from './PageContainer';

interface ErrorPageProps {
  /** Optional error message to display */
  errorMessage?: string;
  /** Optional reset handler for the Try again button */
  onReset?: () => void;
  /** Whether to show the Try again button */
  showResetButton?: boolean;
  /** Whether the application is down (for different messaging) */
  isApplicationDown?: boolean;
}

/**
 * Error Page Component
 * Displays a user-friendly error page with consistent styling
 * Matches the layout, color, and theme of other pages
 */
export function ErrorPage({
  errorMessage,
  onReset,
  showResetButton = false,
  isApplicationDown = false,
}: ErrorPageProps): React.JSX.Element {
  const defaultMessage = isApplicationDown
    ? 'The application is currently unavailable. Please try again later or contact support if the problem persists.'
    : 'Please try refreshing the page or navigating away.';

  return (
    <Layout title="Error" hideSearch>
      <PageContainer>
        <Card sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1" color="error" gutterBottom>
              {isApplicationDown ? 'Application Unavailable' : 'Something went wrong on this page'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {errorMessage ?? defaultMessage}
            </Typography>
            {showResetButton && onReset !== undefined ? (
              <Button variant="contained" onClick={onReset} sx={{ alignSelf: 'flex-start' }}>
                Try again
              </Button>
            ) : null}
            {isApplicationDown ? (
              <Button
                variant="outlined"
                onClick={() => {
                  window.location.reload();
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Refresh Page
              </Button>
            ) : null}
          </Stack>
        </Card>
      </PageContainer>
    </Layout>
  );
}
