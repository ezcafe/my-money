/**
 * Transaction Add Page
 * Page for adding new transactions with optional recurring transaction support
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Box, Typography, Switch, FormControlLabel, Popover, Checkbox } from '@mui/material';
import { CalendarToday } from '@mui/icons-material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery } from '@apollo/client/react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { MobileSelect } from '../components/ui/MobileSelect';
import { CREATE_TRANSACTION, CREATE_RECURRING_TRANSACTION } from '../graphql/mutations';
import {
  GET_CATEGORIES_AND_PAYEES,
  GET_TRANSACTIONS,
  GET_RECENT_TRANSACTIONS,
  GET_ACCOUNT,
  GET_RECURRING_TRANSACTIONS,
} from '../graphql/queries';
import { useAccounts } from '../hooks/useAccounts';
import { useHeader } from '../contexts/HeaderContext';
import {
  getRecurringTypeOptions,
  getCronExpression,
  type RecurringType,
} from '../utils/recurringTypes';
import { validateReturnUrl } from '../utils/validation';
import { PageContainer } from '../components/common/PageContainer';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  sortCategoriesByTypeAndName,
} from '../utils/groupSelectOptions';
import type { Account } from '../hooks/useAccounts';
import type { Category } from '../hooks/useCategories';

/**
 * Optional props passed by TransactionAddPageWrapper (from location state or search params).
 * Prefilled values are not read from search params inside this page.
 */
export interface TransactionAddPageProps {
  /** Prefilled amount (e.g. from home keypad display click) */
  prefilledAmount?: number;
  /** Prefilled account id */
  prefilledAccountId?: string;
  /** Prefilled category id */
  prefilledCategoryId?: string;
  /** Prefilled payee id */
  prefilledPayeeId?: string;
  /** Return URL after save (from wrapper: state or search param returnTo) */
  returnTo?: string;
}

/**
 * Transaction Add Page Component
 * Accepts optional prefilled props from wrapper. Recurring section shown only when returnTo === '/schedule'.
 */
export function TransactionAddPage({
  prefilledAmount,
  prefilledAccountId,
  prefilledCategoryId,
  prefilledPayeeId,
  returnTo: returnToProp,
}: TransactionAddPageProps = {}): React.JSX.Element {
  const navigate = useNavigate();
  const returnTo = validateReturnUrl(returnToProp, '/');
  const { setTitle } = useHeader();

  /** Show Recurring section only when navigated from schedule page */
  const showRecurring = returnTo === '/schedule';

  const { accounts } = useAccounts();
  const { data: combinedData } = useQuery<{
    categories?: Array<{ id: string; name: string; categoryType: string; isDefault: boolean }>;
    payees?: Array<{ id: string; name: string; isDefault: boolean }>;
  }>(GET_CATEGORIES_AND_PAYEES);

  const categories = useMemo(
    () => sortCategoriesByTypeAndName((combinedData?.categories ?? []) as Category[]),
    [combinedData?.categories]
  );
  const payees = useMemo(() => combinedData?.payees ?? [], [combinedData?.payees]);

  // State declarations must come before they are used
  const [value, setValue] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');

  // Find selected account and category objects for Autocomplete
  const selectedAccount = accounts.find((acc) => acc.id === accountId) ?? null;
  const selectedCategory = categories.find((cat) => cat.id === categoryId) ?? null;
  const [payeeId, setPayeeId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(true);
  const prefilledAppliedRef = useRef<boolean>(false);
  const [recurringType, setRecurringType] = useState<RecurringType>('monthly');
  const [nextRunDate, setNextRunDate] = useState<Dayjs | null>(dayjs().add(1, 'day'));
  const [alsoCreateNow, setAlsoCreateNow] = useState<boolean>(false);
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [valueError, setValueError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Apply prefilled props once when data is loaded (only set ids that exist in lists)
  useEffect(() => {
    if (prefilledAppliedRef.current) {
      return;
    }
    const hasPrefilled =
      prefilledAmount != null ||
      prefilledAccountId != null ||
      prefilledCategoryId != null ||
      prefilledPayeeId != null;
    if (!hasPrefilled) {
      return;
    }
    if (prefilledAmount != null && Number.isFinite(prefilledAmount)) {
      setValue(String(prefilledAmount));
    }
    if (prefilledAccountId != null && accounts.some((acc) => acc.id === prefilledAccountId)) {
      setAccountId(prefilledAccountId);
    }
    if (prefilledCategoryId != null && categories.some((cat) => cat.id === prefilledCategoryId)) {
      setCategoryId(prefilledCategoryId);
    }
    if (prefilledPayeeId != null && payees.some((p) => p.id === prefilledPayeeId)) {
      setPayeeId(prefilledPayeeId);
    }
    prefilledAppliedRef.current = true;
  }, [
    prefilledAmount,
    prefilledAccountId,
    prefilledCategoryId,
    prefilledPayeeId,
    accounts,
    categories,
    payees,
  ]);

  // Set default account if available (when no prefilled account)
  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      const defaultAccount = accounts.find((acc) => acc.isDefault) ?? accounts[0];
      if (defaultAccount) {
        setAccountId(defaultAccount.id);
      }
    }
  }, [accounts, accountId]);

  // Set appbar title
  useEffect(() => {
    setTitle('Add Transaction');
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [setTitle]);

  const [createTransaction, { loading: creatingTransaction }] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: () => {
      const queries: Array<
        | { query: typeof GET_TRANSACTIONS }
        | { query: typeof GET_RECENT_TRANSACTIONS }
        | { query: typeof GET_ACCOUNT; variables: { id: string } }
        | { query: typeof GET_RECURRING_TRANSACTIONS }
      > = [
        { query: GET_TRANSACTIONS },
        { query: GET_RECENT_TRANSACTIONS },
        { query: GET_RECURRING_TRANSACTIONS },
      ];
      // Only refetch GET_ACCOUNT if we have an accountId from the form
      if (accountId) {
        queries.push({ query: GET_ACCOUNT, variables: { id: accountId } });
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
    },
  });

  const [createRecurringTransaction, { loading: creatingRecurring }] = useMutation(
    CREATE_RECURRING_TRANSACTION,
    {
      refetchQueries: () => {
        const queries: Array<
          | { query: typeof GET_RECURRING_TRANSACTIONS }
          | { query: typeof GET_TRANSACTIONS }
          | { query: typeof GET_RECENT_TRANSACTIONS }
          | { query: typeof GET_ACCOUNT; variables: { id: string } }
        > = [
          { query: GET_RECURRING_TRANSACTIONS },
          { query: GET_TRANSACTIONS },
          { query: GET_RECENT_TRANSACTIONS },
        ];
        // Only refetch GET_ACCOUNT if we have an accountId from the form
        if (accountId) {
          queries.push({ query: GET_ACCOUNT, variables: { id: accountId } });
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
      },
    }
  );

  /**
   * Get formatted next run date text for button
   */
  const nextRunDateText = useMemo(() => {
    if (nextRunDate) {
      return nextRunDate.format('YYYY-MM-DD');
    }
    return 'Next Run Date';
  }, [nextRunDate]);

  /**
   * Handle date picker button click
   */
  const handleDatePickerOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setDatePickerAnchor(event.currentTarget);
  };

  /**
   * Handle date picker close
   */
  const handleDatePickerClose = (): void => {
    setDatePickerAnchor(null);
  };

  /**
   * Handle next run date change from calendar
   */
  const handleNextRunDateChange = (newValue: Dayjs | null): void => {
    setNextRunDate(newValue);
    handleDatePickerClose();
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (): Promise<void> => {
    // Prevent duplicate submissions (e.g., from React StrictMode double-rendering)
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Validation
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        setError('Value must be a valid number');
        setIsSubmitting(false);
        return;
      }

      if (!accountId) {
        setError('Account is required');
        setIsSubmitting(false);
        return;
      }

      // When not from schedule (showRecurring false), always create single transaction
      if (showRecurring && isRecurring) {
        if (!nextRunDate) {
          setError('Next run date is required for recurring transactions');
          setIsSubmitting(false);
          return;
        }

        try {
          // Create recurring transaction
          const cronExpression = getCronExpression(recurringType);
          const recurringInput = {
            cronExpression,
            value: numValue,
            accountId,
            categoryId: categoryId || null,
            payeeId: payeeId || null,
            note: note || null,
            nextRunDate: nextRunDate.toISOString(),
          };

          await createRecurringTransaction({
            variables: {
              input: recurringInput,
            },
          });

          // Optionally create immediate transaction
          if (alsoCreateNow) {
            const transactionInput = {
              value: numValue,
              date: new Date().toISOString(),
              accountId,
              categoryId: categoryId || null,
              payeeId: payeeId || null,
              note: note || null,
            };

            await createTransaction({
              variables: {
                input: transactionInput,
              },
            });
          }

          // Navigate back to return URL
          const validReturnUrl = validateReturnUrl(returnTo, '/');
          void navigate(validReturnUrl);
        } catch (err) {
          // Error already handled by onError callback
          console.error('Error creating recurring transaction:', err);
        }
      } else {
        // Single transaction (from home, direct URL, or recurring form set to one-time)
        try {
          const transactionInput = {
            value: numValue,
            date: new Date().toISOString(),
            accountId,
            categoryId: categoryId || null,
            payeeId: payeeId || null,
            note: note || null,
          };

          await createTransaction({
            variables: {
              input: transactionInput,
            },
          });

          // Navigate back to return URL
          const validReturnUrl = validateReturnUrl(returnTo, '/');
          void navigate(validReturnUrl);
        } catch (err) {
          // Error already handled by onError callback
          console.error('Error creating transaction:', err);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = creatingTransaction || creatingRecurring || isSubmitting;
  const recurringTypeOptions = getRecurringTypeOptions();

  return (
    <PageContainer>
      <Card sx={{ p: 3 }}>
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
            onChange={(e) => {
              const newValue = e.target.value;
              setValue(newValue);
              // Real-time validation
              if (newValue.trim() === '') {
                setValueError('Value is required');
              } else {
                const numValue = parseFloat(newValue);
                if (isNaN(numValue)) {
                  setValueError('Value must be a valid number');
                } else {
                  setValueError(null);
                }
              }
              // Clear general error when user types
              if (error) {
                setError(null);
              }
            }}
            fullWidth
            required
            error={Boolean(valueError)}
            helperText={valueError}
            inputProps={{ step: '0.01' }}
          />

          <MobileSelect<Account>
            value={selectedAccount}
            options={accounts}
            onChange={(account) => {
              const newAccountId = account?.id ?? '';
              setAccountId(newAccountId);
              // Real-time validation
              if (!newAccountId) {
                setAccountError('Account is required');
              } else {
                setAccountError(null);
              }
              // Clear general error when user selects
              if (error) {
                setError(null);
              }
            }}
            getOptionLabel={(option) => option.name}
            getOptionId={(option) => option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            groupBy={(option) => getAccountTypeLabel(option.accountType)}
            label="Account"
            required
            sx={
              accountError
                ? {
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-error': {
                        borderColor: 'error.main',
                      },
                    },
                  }
                : undefined
            }
          />
          {accountError ? (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
              {accountError}
            </Typography>
          ) : null}

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

          {showRecurring ? (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                }
                label="Recurring Transaction"
              />

              {isRecurring ? (
                <>
                  <MobileSelect<{ value: RecurringType; label: string }>
                    value={recurringTypeOptions.find((opt) => opt.value === recurringType) ?? null}
                    options={recurringTypeOptions}
                    onChange={(option) => {
                      if (option) {
                        const newType = option.value;
                        setRecurringType(newType);
                        if (newType === 'minutely') {
                          setNextRunDate(dayjs().add(1, 'minute'));
                        }
                      }
                    }}
                    getOptionLabel={(option) => option.label}
                    getOptionId={(option) => option.value}
                    label="Recurring Type"
                  />

                  <Box>
                    <Button
                      variant="outlined"
                      onClick={handleDatePickerOpen}
                      startIcon={<CalendarToday />}
                      sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      {nextRunDateText}
                    </Button>
                  </Box>

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={alsoCreateNow}
                        onChange={(e) => setAlsoCreateNow(e.target.checked)}
                      />
                    }
                    label="Also create transaction now"
                  />
                </>
              ) : null}
            </>
          ) : null}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={() => {
                const validReturnUrl = validateReturnUrl(returnTo);
                void navigate(validReturnUrl);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>

      {/* Date Picker Popover */}
      <Popover
        open={Boolean(datePickerAnchor)}
        anchorEl={datePickerAnchor}
        onClose={handleDatePickerClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
            <DateCalendar
              value={nextRunDate}
              onChange={handleNextRunDateChange}
              views={['year', 'month', 'day']}
            />
          </Box>
        </LocalizationProvider>
      </Popover>
    </PageContainer>
  );
}
