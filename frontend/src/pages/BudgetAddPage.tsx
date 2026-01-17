/**
 * Budget Add Page
 * Page for adding new budgets
 */

import React, {useState, useEffect, useMemo} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {
  Box,
  TextField,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {CREATE_BUDGET} from '../graphql/mutations';
import {GET_BUDGETS, GET_ACCOUNTS, GET_CATEGORIES, GET_PAYEES} from '../graphql/queries';
import {useTitle} from '../contexts/TitleContext';
import {PageContainer} from '../components/common/PageContainer';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  GROUP_HEADER_STYLES,
} from '../utils/groupSelectOptions';
import type {Account} from '../hooks/useAccounts';
import type {Category} from '../hooks/useCategories';

/**
 * Budget Add Page Component
 */
export function BudgetAddPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/budgets';
  const {setTitle} = useTitle();

  const {data: accountsData} = useQuery<{accounts: Array<{id: string; name: string; accountType: string}>}>(GET_ACCOUNTS);
  const {data: categoriesData} = useQuery<{categories: Array<{id: string; name: string; categoryType: string}>}>(
    GET_CATEGORIES,
  );
  const {data: payeesData} = useQuery<{payees: Array<{id: string; name: string}>}>(GET_PAYEES);

  const accounts = useMemo(() => (accountsData?.accounts ?? []) as Account[], [accountsData?.accounts]);
  const categories = useMemo(() => ((categoriesData?.categories ?? []).filter((c) => c.categoryType === 'Expense')) as Category[], [categoriesData?.categories]);
  const payees = useMemo(() => payeesData?.payees ?? [], [payeesData?.payees]);

  const [budgetType, setBudgetType] = useState<'account' | 'category' | 'payee'>('account');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Find selected account and category objects for Autocomplete
  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === selectedEntityId) ?? null;
  }, [accounts, selectedEntityId]);
  const selectedCategory = useMemo(() => {
    return categories.find((cat) => cat.id === selectedEntityId) ?? null;
  }, [categories, selectedEntityId]);
  const selectedPayee = useMemo(() => {
    return payees.find((p) => p.id === selectedEntityId) ?? null;
  }, [payees, selectedEntityId]);

  // Set appbar title
  useEffect(() => {
    setTitle('Add Budget');
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [setTitle]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   * @param url - URL to validate
   * @returns Valid return URL
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/budgets';
  };

  const [createBudget, {loading: creating}] = useMutation(CREATE_BUDGET, {
    refetchQueries: [{query: GET_BUDGETS}],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL, replacing the add page in history
      const validReturnUrl = getValidReturnUrl(returnTo);
      void navigate(validReturnUrl, {replace: true});
    },
  });

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    setError(null);

    if (!selectedEntityId) {
      setError(`Please select a ${budgetType}`);
      return;
    }

    if (!amount || amount.trim() === '') {
      setError('Amount is required');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    const input: {
      amount: number;
      accountId?: string | null;
      categoryId?: string | null;
      payeeId?: string | null;
    } = {
      amount: amountValue,
    };

    if (budgetType === 'account') {
      input.accountId = selectedEntityId;
    } else if (budgetType === 'category') {
      input.categoryId = selectedEntityId;
    } else if (budgetType === 'payee') {
      input.payeeId = selectedEntityId;
    }

    void createBudget({
      variables: {
        input,
      },
    });
  };

  // Reset selected entity when budget type changes
  useEffect(() => {
    setSelectedEntityId('');
  }, [budgetType]);

  const loading = creating;

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
          {error ? <Typography color="error" variant="body2">
              {error}
            </Typography> : null}

          <Typography variant="body2" color="text.secondary">
            Select the type of budget you want to create
          </Typography>

          <ToggleButtonGroup
            value={budgetType}
            exclusive
            onChange={(_, newValue: 'account' | 'category' | 'payee' | null) => {
              if (newValue !== null) {
                setBudgetType(newValue);
              }
            }}
            fullWidth
          >
            <ToggleButton value="account">Account</ToggleButton>
            <ToggleButton value="category">Category</ToggleButton>
            <ToggleButton value="payee">Payee</ToggleButton>
          </ToggleButtonGroup>

          {budgetType === 'account' && (
            <Autocomplete<Account, false, false, false>
              options={accounts}
              getOptionLabel={(option) => option.name}
              groupBy={(option) => getAccountTypeLabel(option.accountType)}
              value={selectedAccount}
              onChange={(_, value) => {
                setSelectedEntityId(value?.id ?? '');
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              componentsProps={{
                popper: {
                  sx: GROUP_HEADER_STYLES,
                },
              }}
              renderInput={(params) => <TextField {...params} label="Account" required />}
            />
          )}

          {budgetType === 'category' && (
            <Autocomplete<Category, false, false, false>
              options={categories}
              getOptionLabel={(option) => option.name}
              groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
              value={selectedCategory}
              onChange={(_, value) => {
                setSelectedEntityId(value?.id ?? '');
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              componentsProps={{
                popper: {
                  sx: GROUP_HEADER_STYLES,
                },
              }}
              renderInput={(params) => <TextField {...params} label="Category" required />}
            />
          )}

          {budgetType === 'payee' && (
            <Autocomplete<{id: string; name: string}, false, false, false>
              options={payees}
              getOptionLabel={(option) => option.name}
              value={selectedPayee}
              onChange={(_, value) => {
                setSelectedEntityId(value?.id ?? '');
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Payee" required />}
            />
          )}

          <TextField
            label="Budget Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            inputProps={{step: '0.01', min: '0.01'}}
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
              {loading ? 'Creating...' : 'Create Budget'}
            </Button>
          </Box>
        </Box>
      </Card>
    </PageContainer>
  );
}

