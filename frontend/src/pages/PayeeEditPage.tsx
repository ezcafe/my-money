/**
 * Payee Edit Page
 * Page for creating/editing payee details
 */

import React, {useState, useEffect} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router';
import {Box, Typography, Button} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {TextField} from '../components/ui/TextField';
import {CREATE_PAYEE, UPDATE_PAYEE} from '../graphql/mutations';
import {GET_PAYEE} from '../graphql/queries';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {useTitle} from '../contexts/TitleContext';

/**
 * Payee data from GraphQL query
 */
interface PayeeData {
  payee?: {
    id: string;
    name: string;
    icon: string | null;
    isDefault: boolean;
  } | null;
}

/**
 * Payee Edit Page Component
 */
export function PayeeEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/payees';
  const {setTitle} = useTitle();
  const isEditMode = Boolean(id);

  const {data: payeeData, loading: payeeLoading, error: payeeError} = useQuery<PayeeData>(
    GET_PAYEE,
    {
      variables: {id},
      skip: !id,
      errorPolicy: 'all',
    },
  );

  const payee = payeeData?.payee;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Set appbar title
  useEffect(() => {
    setTitle(isEditMode ? 'Edit Payee' : 'Create Payee');
    // Cleanup: clear title when component unmounts
    return () => {
      setTitle(undefined);
    };
  }, [setTitle, isEditMode]);

  // Initialize form when payee is loaded
  useEffect(() => {
    if (payee) {
      setName(payee.name);
      setIcon(payee.icon ?? '');
      setError(null);
    } else if (!isEditMode) {
      // Reset form for create mode
      setName('');
      setIcon('');
      setError(null);
    }
  }, [payee, isEditMode]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/payees';
  };

  const [createPayee, {loading: creating}] = useMutation(CREATE_PAYEE, {
    refetchQueries: ['GetPayees'],
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

  const [updatePayee, {loading: updating}] = useMutation(UPDATE_PAYEE, {
    refetchQueries: ['GetPayees', 'GetPayee'],
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

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (isEditMode && id) {
      // Update existing payee
      void updatePayee({
        variables: {
          id,
          input: {
            name,
            icon: icon || null,
          },
        },
      });
    } else {
      // Create new payee
      void createPayee({
        variables: {
          input: {
            name,
            icon: icon || null,
          },
        },
      });
    }
  };

  // Show loading state for edit mode
  if (isEditMode && payeeLoading) {
    return <LoadingSpinner message="Loading payee..." />;
  }

  // Show error state for edit mode
  if (isEditMode && payeeError) {
    return (
      <ErrorAlert
        title="Error Loading Payee"
        message={payeeError?.message ?? 'Error loading payee details'}
      />
    );
  }

  // Show not found state for edit mode
  if (isEditMode && !payee) {
    return (
      <ErrorAlert
        title="Payee Not Found"
        message="The requested payee could not be found."
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
            label="Icon (optional)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            fullWidth
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

