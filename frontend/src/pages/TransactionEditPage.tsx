/**
 * Transaction Edit Page
 * Page for editing transaction details
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import {
  Box,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import { useMutation, useQuery } from '@apollo/client/react';
import { Card } from '../components/ui/Card';
import { UPDATE_TRANSACTION } from '../graphql/mutations';
import {
  GET_TRANSACTION,
  GET_CATEGORIES,
  GET_PAYEES,
  GET_TRANSACTIONS,
  GET_RECENT_TRANSACTIONS,
  GET_ACCOUNT,
} from '../graphql/queries';
import { useAccounts } from '../hooks/useAccounts';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { useHeader } from '../contexts/HeaderContext';
import type { Transaction } from '../hooks/useTransactions';
import { PageContainer } from '../components/common/PageContainer';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  sortCategoriesByTypeAndName,
} from '../utils/groupSelectOptions';
import type { Account } from '../hooks/useAccounts';
import type { Category } from '../hooks/useCategories';
import { MobileSelect } from '../components/ui/MobileSelect';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';

/**
 * Transaction data from GraphQL query
 */
interface TransactionData {
  transaction?: Transaction | null;
}

/**
 * Transaction Edit Page Component
 */
export function TransactionEditPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const { setTitle } = useHeader();

  const { accounts } = useAccounts();
  const { data: categoriesData } = useQuery<{
    categories?: Array<{ id: string; name: string; categoryType: string }>;
  }>(GET_CATEGORIES);
  const { data: payeesData } = useQuery<{ payees?: Array<{ id: string; name: string }> }>(
    GET_PAYEES
  );
  const {
    data: transactionData,
    loading: transactionLoading,
    error: transactionError,
  } = useQuery<TransactionData>(GET_TRANSACTION, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  const categories = useMemo(
    () => sortCategoriesByTypeAndName((categoriesData?.categories ?? []) as Category[]),
    [categoriesData?.categories]
  );
  const payees = payeesData?.payees ?? [];
  const transaction = transactionData?.transaction;

  const [value, setValue] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [payeeId, setPayeeId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Find selected account and category objects for Autocomplete
  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === accountId) ?? null;
  }, [accounts, accountId]);
  const selectedCategory = useMemo(() => {
    return categories.find((cat) => cat.id === categoryId) ?? null;
  }, [categories, categoryId]);

  // Set appbar title
  useEffect(() => {
    setTitle('Edit Transaction');
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [setTitle]);

  // Initialize form when transaction is loaded
  useEffect(() => {
    if (transaction) {
      setValue(String(transaction.value ?? ''));
      const dateValue =
        typeof transaction.date === 'string'
          ? (transaction.date.split('T')[0] ?? '')
          : (new Date(transaction.date).toISOString().split('T')[0] ?? '');
      setDate(dateValue);
      setAccountId(transaction.account?.id ?? '');
      setCategoryId(transaction.category?.id ?? '');
      setPayeeId(transaction.payee?.id ?? '');
      setNote(transaction.note ?? '');
      setError(null);
    }
  }, [transaction]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/';
  };

  const [updateTransaction, { loading }] = useMutation(UPDATE_TRANSACTION, {
    refetchQueries: () => {
      const queries: Array<
        | { query: typeof GET_TRANSACTIONS }
        | { query: typeof GET_RECENT_TRANSACTIONS }
        | { query: typeof GET_ACCOUNT; variables: { id: string } }
      > = [{ query: GET_TRANSACTIONS }, { query: GET_RECENT_TRANSACTIONS }];
      // Only refetch GET_ACCOUNT if we have an accountId from the transaction
      if (transaction?.account?.id) {
        queries.push({ query: GET_ACCOUNT, variables: { id: transaction.account.id } });
      }
      return queries;
    },
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

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    if (!transaction || !id) {
      return;
    }

    setError(null);

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setError('Value must be a valid number');
      return;
    }

    const updateInput: {
      value?: number;
      date?: string;
      accountId?: string;
      categoryId?: string | null;
      payeeId?: string | null;
      note?: string | null;
    } = {};

    if (value !== String(transaction.value ?? '')) {
      updateInput.value = numValue;
    }
    if (date) {
      const transactionDate =
        typeof transaction.date === 'string'
          ? transaction.date.split('T')[0]
          : new Date(transaction.date).toISOString().split('T')[0];
      if (date !== transactionDate) {
        updateInput.date = new Date(date).toISOString();
      }
    }
    if (accountId && accountId !== transaction.account?.id) {
      updateInput.accountId = accountId;
    }
    if (categoryId !== (transaction.category?.id ?? '')) {
      updateInput.categoryId = categoryId || null;
    }
    if (payeeId !== (transaction.payee?.id ?? '')) {
      updateInput.payeeId = payeeId || null;
    }
    if (note !== (transaction.note ?? '')) {
      updateInput.note = note || null;
    }

    void updateTransaction({
      variables: {
        id,
        input: updateInput,
      },
    });
  };

  // Show loading state
  if (transactionLoading) {
    return <LoadingSpinner message="Loading transaction..." />;
  }

  // Show error state
  if (transactionError) {
    return (
      <ErrorAlert
        title="Error Loading Transaction"
        message={transactionError?.message ?? 'Error loading transaction details'}
      />
    );
  }

  // Show not found state
  if (!transaction) {
    return (
      <ErrorAlert
        title="Transaction Not Found"
        message="The requested transaction could not be found."
        severity="warning"
      />
    );
  }

  return (
    <PageContainer>
      <Card sx={{ mb: 3, p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : null}

          <TextField
            label="Value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
            required
            inputProps={{ step: '0.01' }}
          />

          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />

          <MobileSelect<Account>
            value={selectedAccount}
            options={accounts}
            onChange={(account) => {
              setAccountId(account?.id ?? '');
            }}
            getOptionLabel={(option) => option.name}
            getOptionId={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            groupBy={(option) => getAccountTypeLabel(option.accountType)}
            label="Account"
          />

          <MobileSelect<Category>
            value={selectedCategory}
            options={categories}
            onChange={(category) => {
              setCategoryId(category?.id ?? '');
            }}
            getOptionLabel={(option) => option.name}
            getOptionId={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
            label="Category"
          />

          <MobileSelect<{ id: string; name: string }>
            value={payees.find((p) => p.id === payeeId) ?? null}
            options={payees}
            onChange={(payee) => {
              setPayeeId(payee?.id ?? '');
            }}
            getOptionLabel={(option) => option.name}
            getOptionId={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            label="Payee"
          />

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={() => {
                const validReturnUrl = getValidReturnUrl(returnTo);
                void navigate(validReturnUrl);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Version History Section - pass current transaction so only changed fields are shown */}
      {id ? (
        <VersionHistoryPanel
          entityType="Transaction"
          entityId={id}
          currentData={
            transaction
              ? {
                  value: transaction.value,
                  date:
                    typeof transaction.date === 'string'
                      ? transaction.date
                      : new Date(transaction.date).toISOString(),
                  accountId: transaction.account?.id ?? '',
                  categoryId: transaction.category?.id ?? '',
                  payeeId: transaction.payee?.id ?? '',
                  note: transaction.note ?? '',
                }
              : undefined
          }
        />
      ) : null}
    </PageContainer>
  );
}
