/**
 * Budget Edit Page
 * Page for editing budget amount
 */

import React, {useState, useEffect} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router';
import {Box, Typography, Button} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {TextField} from '../components/ui/TextField';
import {UPDATE_BUDGET} from '../graphql/mutations';
import {GET_BUDGET} from '../graphql/queries';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {useTitle} from '../contexts/TitleContext';
import {PageContainer} from '../components/common/PageContainer';

/**
 * Budget data from GraphQL query
 */
interface BudgetData {
  budget?: {
    id: string;
    amount: string;
    accountId: string | null;
    categoryId: string | null;
    payeeId: string | null;
    account: {
      id: string;
      name: string;
    } | null;
    category: {
      id: string;
      name: string;
      type: string;
    } | null;
    payee: {
      id: string;
      name: string;
    } | null;
  } | null;
}

/**
 * Budget Edit Page Component
 */
export function BudgetEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/budgets';
  const {setTitle} = useTitle();

  const {data: budgetData, loading: budgetLoading, error: budgetError} = useQuery<BudgetData>(
    GET_BUDGET,
    {
      variables: {id},
      skip: !id,
      errorPolicy: 'all',
    },
  );

  const budget = budgetData?.budget;

  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Set appbar title
  useEffect(() => {
    setTitle('Edit Budget');
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [setTitle]);

  // Initialize form when budget is loaded
  useEffect(() => {
    if (budget) {
      setAmount(budget.amount);
      setError(null);
    }
  }, [budget]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/budgets';
  };

  const [updateBudget, {loading: updating}] = useMutation(UPDATE_BUDGET, {
    refetchQueries: ['GetBudgets', 'GetBudget'],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL
      const validReturnUrl = getValidReturnUrl(returnTo);
      void navigate(validReturnUrl);
    },
  });

  const loading = updating;

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    setError(null);

    if (!amount || amount.trim() === '') {
      setError('Amount is required');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    if (id) {
      // Update existing budget
      void updateBudget({
        variables: {
          id,
          input: {
            amount: amountValue,
          },
        },
      });
    }
  };

  // Show loading state
  if (budgetLoading) {
    return <LoadingSpinner message="Loading budget..." />;
  }

  if (budgetError) {
    return (
      <ErrorAlert
        title="Error Loading Budget"
        message={budgetError?.message ?? 'Error loading budget details'}
      />
    );
  }

  if (!budget) {
    return (
      <ErrorAlert
        title="Budget Not Found"
        message="The requested budget could not be found."
        severity="warning"
      />
    );
  }

  const budgetName = budget.account?.name ?? budget.category?.name ?? budget.payee?.name ?? 'Budget';

  return (
    <PageContainer
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Card
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 3,
        }}
      >
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, flex: 1}}>
          <Typography variant="h6" component="h2">
            Edit Budget
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Budget for: {budgetName}
          </Typography>

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <TextField
            label="Budget Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            inputProps={{min: 0, step: 0.01}}
            helperText="Enter the monthly budget amount"
          />

          <Box sx={{display: 'flex', gap: 2, mt: 'auto', pt: 2}}>
            <Button
              variant="outlined"
              onClick={() => {
                const validReturnUrl = getValidReturnUrl(returnTo);
                void navigate(validReturnUrl);
              }}
              disabled={loading}
              fullWidth
            >
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading} fullWidth>
              {loading ? 'Updating...' : 'Update Budget'}
            </Button>
          </Box>
        </Box>
      </Card>
    </PageContainer>
  );
}

