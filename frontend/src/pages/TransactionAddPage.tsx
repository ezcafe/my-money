/**
 * Transaction Add Page
 * Page for adding new transactions with optional recurring transaction support
 */

import React, {useState, useEffect, useMemo} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Switch,
  FormControlLabel,
  Popover,
  Checkbox,
} from '@mui/material';
import {CalendarToday} from '@mui/icons-material';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, {type Dayjs} from 'dayjs';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {CREATE_TRANSACTION, CREATE_RECURRING_TRANSACTION} from '../graphql/mutations';
import {GET_CATEGORIES_AND_PAYEES, GET_TRANSACTIONS, GET_RECENT_TRANSACTIONS, GET_ACCOUNT, GET_RECURRING_TRANSACTIONS} from '../graphql/queries';
import {useAccounts} from '../hooks/useAccounts';
import {useTitle} from '../contexts/TitleContext';
import {getRecurringTypeOptions, getCronExpression, type RecurringType} from '../utils/recurringTypes';
import {validateReturnUrl} from '../utils/validation';

/**
 * Transaction Add Page Component
 */
export function TransactionAddPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = validateReturnUrl(searchParams.get('returnTo'), '/');
  const {setTitle} = useTitle();

  const {accounts} = useAccounts();
  const {data: combinedData} = useQuery<{
    categories?: Array<{id: string; name: string; type: string; isDefault: boolean}>;
    payees?: Array<{id: string; name: string; isDefault: boolean}>;
  }>(GET_CATEGORIES_AND_PAYEES);

  const categories = combinedData?.categories ?? [];
  const payees = combinedData?.payees ?? [];

  const [value, setValue] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [payeeId, setPayeeId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(true);
  const [recurringType, setRecurringType] = useState<RecurringType>('monthly');
  const [nextRunDate, setNextRunDate] = useState<Dayjs | null>(dayjs().add(1, 'day'));
  const [alsoCreateNow, setAlsoCreateNow] = useState<boolean>(false);
  const [datePickerAnchor, setDatePickerAnchor] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [valueError, setValueError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Set default account if available
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


  const [createTransaction, {loading: creatingTransaction}] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: () => {
      const queries: Array<{query: typeof GET_TRANSACTIONS} | {query: typeof GET_RECENT_TRANSACTIONS} | {query: typeof GET_ACCOUNT; variables: {id: string}} | {query: typeof GET_RECURRING_TRANSACTIONS}> = [
        {query: GET_TRANSACTIONS},
        {query: GET_RECENT_TRANSACTIONS},
        {query: GET_RECURRING_TRANSACTIONS},
      ];
      // Only refetch GET_ACCOUNT if we have an accountId from the form
      if (accountId) {
        queries.push({query: GET_ACCOUNT, variables: {id: accountId}});
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

  const [createRecurringTransaction, {loading: creatingRecurring}] = useMutation(
    CREATE_RECURRING_TRANSACTION,
    {
      refetchQueries: () => {
        const queries: Array<{query: typeof GET_RECURRING_TRANSACTIONS} | {query: typeof GET_TRANSACTIONS} | {query: typeof GET_RECENT_TRANSACTIONS} | {query: typeof GET_ACCOUNT; variables: {id: string}}> = [
          {query: GET_RECURRING_TRANSACTIONS},
          {query: GET_TRANSACTIONS},
          {query: GET_RECENT_TRANSACTIONS},
        ];
        // Only refetch GET_ACCOUNT if we have an accountId from the form
        if (accountId) {
          queries.push({query: GET_ACCOUNT, variables: {id: accountId}});
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
    },
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

      if (isRecurring) {
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
          const validReturnUrl = validateReturnUrl(returnTo);
          void navigate(validReturnUrl);
        } catch (err) {
          // Error already handled by onError callback
          console.error('Error creating recurring transaction:', err);
        }
      } else {
        // Create regular transaction
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
          const validReturnUrl = validateReturnUrl(returnTo);
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
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        width: {xs: '100%', sm: '100%'},
        maxWidth: {xs: '100%', sm: '400px'},
        mx: {xs: 0, sm: 'auto'},
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
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

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
            inputProps={{step: '0.01'}}
          />

          <FormControl fullWidth required error={Boolean(accountError)}>
            <InputLabel>Account</InputLabel>
            <Select
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                // Real-time validation
                if (!e.target.value) {
                  setAccountError('Account is required');
                } else {
                  setAccountError(null);
                }
                // Clear general error when user selects
                if (error) {
                  setError(null);
                }
              }}
              label="Account"
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
            {accountError && (
              <Typography variant="caption" color="error" sx={{mt: 0.5, ml: 1.75}}>
                {accountError}
              </Typography>
            )}
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              label="Category"
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Payee</InputLabel>
            <Select value={payeeId} onChange={(e) => setPayeeId(e.target.value)} label="Payee">
              {payees.map((payee) => (
                <MenuItem key={payee.id} value={payee.id}>
                  {payee.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />

          <FormControlLabel
            control={
              <Switch checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            }
            label="Recurring Transaction"
          />

          {isRecurring && (
            <>
              <FormControl fullWidth>
                <InputLabel>Recurring Type</InputLabel>
                <Select
                  value={recurringType}
                  onChange={(e) => setRecurringType(e.target.value as RecurringType)}
                  label="Recurring Type"
                >
                  {recurringTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Button
                  variant="outlined"
                  onClick={handleDatePickerOpen}
                  startIcon={<CalendarToday />}
                  sx={{justifyContent: 'flex-start', textTransform: 'none'}}
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
          )}

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 'auto'}}>
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
          <Box sx={{display: 'flex', flexDirection: 'column', p: 2}}>
            <DateCalendar
              value={nextRunDate}
              onChange={handleNextRunDateChange}
              views={['year', 'month', 'day']}
            />
          </Box>
        </LocalizationProvider>
      </Popover>
    </Box>
  );
}

