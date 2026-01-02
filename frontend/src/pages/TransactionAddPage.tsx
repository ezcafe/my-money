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
import {GET_CATEGORIES, GET_PAYEES} from '../graphql/queries';
import {useAccounts} from '../hooks/useAccounts';
import {useTitle} from '../contexts/TitleContext';
import {getRecurringTypeOptions, getCronExpression, type RecurringType} from '../utils/recurringTypes';

/**
 * Transaction Add Page Component
 */
export function TransactionAddPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';
  const {setTitle} = useTitle();

  const {accounts} = useAccounts();
  const {data: categoriesData} = useQuery<{categories?: Array<{id: string; name: string}>}>(
    GET_CATEGORIES,
  );
  const {data: payeesData} = useQuery<{payees?: Array<{id: string; name: string}>}>(
    GET_PAYEES,
  );

  const categories = categoriesData?.categories ?? [];
  const payees = payeesData?.payees ?? [];

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
    return () => {
      setTitle(undefined);
    };
  }, [setTitle]);

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

  const [createTransaction, {loading: creatingTransaction}] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetAccount', 'GetRecurringTransactions'],
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
      refetchQueries: ['GetRecurringTransactions', 'GetTransactions', 'GetRecentTransactions', 'GetAccount'],
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
          const validReturnUrl = getValidReturnUrl(returnTo);
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
          const validReturnUrl = getValidReturnUrl(returnTo);
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
    <Box sx={{width: '100%', maxWidth: 600, mx: 'auto'}}>
      <Card sx={{p: 3}}>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <TextField
            label="Value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
            required
            inputProps={{step: '0.01'}}
          />

          <FormControl fullWidth>
            <InputLabel>Account</InputLabel>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} label="Account" required>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
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
                  sx={{width: '100%', justifyContent: 'flex-start', textTransform: 'none'}}
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

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
            <Button
              onClick={() => {
                const validReturnUrl = getValidReturnUrl(returnTo);
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

