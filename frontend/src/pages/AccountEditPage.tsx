/**
 * Account Edit Page
 * Page for creating/editing account details
 */

import React, {useState, useEffect} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router';
import {Box, Typography, Button} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {TextField} from '../components/ui/TextField';
import {CREATE_ACCOUNT, UPDATE_ACCOUNT} from '../graphql/mutations';
import {GET_ACCOUNT} from '../graphql/queries';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {useTitle} from '../contexts/TitleContext';

/**
 * Account data from GraphQL query
 */
interface AccountData {
  account?: {
    id: string;
    name: string;
    initBalance: number;
    isDefault: boolean;
    balance: number;
  } | null;
}

/**
 * Account Edit Page Component
 */
export function AccountEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/accounts';
  const {setTitle} = useTitle();
  const isEditMode = Boolean(id);

  const {data: accountData, loading: accountLoading, error: accountError} = useQuery<AccountData>(
    GET_ACCOUNT,
    {
      variables: {id},
      skip: !id,
      errorPolicy: 'all',
    },
  );

  const account = accountData?.account;

  const [name, setName] = useState('');
  const [initBalance, setInitBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);

  // Set appbar title
  useEffect(() => {
    setTitle(isEditMode ? 'Edit Account' : 'Create Account');
    // Cleanup: clear title when component unmounts
    return () => {
      setTitle(undefined);
    };
  }, [setTitle, isEditMode]);

  // Initialize form when account is loaded
  useEffect(() => {
    if (account) {
      setName(account.name);
      setInitBalance(String(account.initBalance));
      setError(null);
    } else if (!isEditMode) {
      // Reset form for create mode
      setName('');
      setInitBalance('0');
      setError(null);
    }
  }, [account, isEditMode]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/accounts';
  };

  const [createAccount, {loading: creating}] = useMutation(CREATE_ACCOUNT, {
    refetchQueries: ['GetAccounts'],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL
      const validReturnUrl = getValidReturnUrl(returnTo);
      navigate(validReturnUrl);
    },
  });

  const [updateAccount, {loading: updating}] = useMutation(UPDATE_ACCOUNT, {
    refetchQueries: ['GetAccounts', 'GetAccount'],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL
      const validReturnUrl = getValidReturnUrl(returnTo);
      navigate(validReturnUrl);
    },
  });

  const loading = creating || updating;

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    setError(null);
    const balance = parseFloat(initBalance);
    if (isNaN(balance)) {
      setError('Initial balance must be a valid number');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (isEditMode && id) {
      // Update existing account
      void updateAccount({
        variables: {
          id,
          input: {
            name,
            initBalance: balance,
          },
        },
      });
    } else {
      // Create new account
      void createAccount({
        variables: {
          input: {
            name,
            initBalance: balance,
          },
        },
      });
    }
  };

  // Show loading state for edit mode
  if (isEditMode && accountLoading) {
    return <LoadingSpinner message="Loading account..." />;
  }

  // Show error state for edit mode
  if (isEditMode && accountError) {
    return (
      <ErrorAlert
        title="Error Loading Account"
        message={accountError?.message ?? 'Error loading account details'}
      />
    );
  }

  // Show not found state for edit mode
  if (isEditMode && !account) {
    return (
      <ErrorAlert
        title="Account Not Found"
        message="The requested account could not be found."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{width: '100%', maxWidth: 600, mx: 'auto'}}>
      <Card sx={{p: 3}}>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Initial Balance"
            type="number"
            value={initBalance}
            onChange={(e) => setInitBalance(e.target.value)}
            fullWidth
            required
            inputProps={{step: '0.01'}}
          />

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
            <Button
              onClick={() => {
                const validReturnUrl = getValidReturnUrl(returnTo);
                navigate(validReturnUrl);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

