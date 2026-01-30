/**
 * Budget Add Page
 * Page for adding new budgets
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Box, TextField, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useMutation, useQuery } from '@apollo/client/react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CREATE_BUDGET } from '../graphql/mutations';
import { GET_BUDGETS, GET_ACCOUNTS, GET_CATEGORIES, GET_PAYEES } from '../graphql/queries';
import { useHeader } from '../contexts/HeaderContext';
import { PageContainer } from '../components/common/PageContainer';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  sortCategoriesByTypeAndName,
} from '../utils/groupSelectOptions';
import type { Account } from '../hooks/useAccounts';
import type { Category } from '../hooks/useCategories';
import { MobileSelect } from '../components/ui/MobileSelect';

/**
 * Budget Add Page Component
 */
export function BudgetAddPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/budgets';
  const { setTitle } = useHeader();

  const { data: accountsData } = useQuery<{
    accounts: Array<{ id: string; name: string; accountType: string }>;
  }>(GET_ACCOUNTS);
  const { data: categoriesData } = useQuery<{
    categories: Array<{ id: string; name: string; categoryType: string }>;
  }>(GET_CATEGORIES);
  const { data: payeesData } = useQuery<{ payees: Array<{ id: string; name: string }> }>(
    GET_PAYEES
  );

  const accounts = useMemo(
    () => (accountsData?.accounts ?? []) as Account[],
    [accountsData?.accounts]
  );
  const categories = useMemo(
    () =>
      sortCategoriesByTypeAndName(
        ((categoriesData?.categories ?? []).filter(
          (c) => c.categoryType === 'Expense'
        ) as Category[]) ?? []
      ),
    [categoriesData?.categories]
  );
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

  const [createBudget, { loading: creating }] = useMutation(CREATE_BUDGET, {
    refetchQueries: [{ query: GET_BUDGETS }],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL, replacing the add page in history
      const validReturnUrl = getValidReturnUrl(returnTo);
      void navigate(validReturnUrl, { replace: true });
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
    <PageContainer>
      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : null}

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
            <MobileSelect<Account>
              value={selectedAccount}
              options={accounts}
              onChange={(account) => {
                setSelectedEntityId(account?.id ?? '');
              }}
              getOptionLabel={(option) => option.name}
              getOptionId={(option) => option.id}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              groupBy={(option) => getAccountTypeLabel(option.accountType)}
              label="Account"
              required
            />
          )}

          {budgetType === 'category' && (
            <MobileSelect<Category>
              value={selectedCategory}
              options={categories}
              onChange={(category) => {
                setSelectedEntityId(category?.id ?? '');
              }}
              getOptionLabel={(option) => option.name}
              getOptionId={(option) => option.id}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
              label="Category"
              required
            />
          )}

          {budgetType === 'payee' && (
            <MobileSelect<{ id: string; name: string }>
              value={selectedPayee}
              options={payees}
              onChange={(payee) => {
                setSelectedEntityId(payee?.id ?? '');
              }}
              getOptionLabel={(option) => option.name}
              getOptionId={(option) => option.id}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              label="Payee"
              required
            />
          )}

          <TextField
            label="Budget Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            inputProps={{ step: '0.01', min: '0.01' }}
            helperText="Enter the monthly budget amount"
          />

          <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
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
