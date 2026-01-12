/**
 * Schedule Page
 * Manage recurring transactions
 * Follows Material Design 3 patterns
 */

import React, {useEffect} from 'react';
import {useLocation} from 'react-router';
import {Box, Typography, List, ListItem, Chip, Stack, Divider} from '@mui/material';
import {Schedule} from '@mui/icons-material';
import {useQuery} from '@apollo/client/react';
import {GET_RECURRING_TRANSACTIONS, GET_PREFERENCES} from '../graphql/queries';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {getRecurringTypeOptions, type RecurringType} from '../utils/recurringTypes';
import {useDateFormat} from '../hooks/useDateFormat';

/**
 * Recurring transaction type from GraphQL
 */
interface RecurringTransaction {
  id: string;
  cronExpression: string;
  value: number;
  accountId: string;
  account: {
    id: string;
    name: string;
  } | null;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  payeeId: string | null;
  payee: {
    id: string;
    name: string;
  } | null;
  note: string | null;
  nextRunDate: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Recurring transactions data from GraphQL query
 */
interface RecurringTransactionsData {
  recurringTransactions?: RecurringTransaction[];
}

/**
 * Get recurring type from cron expression
 * @param cronExpression - Cron expression string
 * @returns Recurring type or null if not a preset
 */
function getRecurringTypeFromCron(cronExpression: string): RecurringType | null {
  const typeMap: Record<string, RecurringType> = {
    '0 0 * * *': 'daily',
    '0 0 * * 0': 'weekly',
    '0 0 1 * *': 'monthly',
    '0 0 1 1 *': 'yearly',
  };
  return typeMap[cronExpression] ?? null;
}

/**
 * Schedule Page Component
 */
export function SchedulePage(): React.JSX.Element {
  const location = useLocation();
  const {data, loading, error, refetch} = useQuery<RecurringTransactionsData>(
    GET_RECURRING_TRANSACTIONS,
    {
      fetchPolicy: 'cache-and-network',
    },
  );
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';
  const {dateFormat} = useDateFormat();

  // Refetch when returning from add page
  useEffect(() => {
    if (location.pathname === '/schedule') {
      void refetch();
    }
  }, [location.pathname, refetch]);

  if (loading) {
    return <LoadingSpinner message="Loading recurring transactions..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Recurring Transactions"
        message={error.message}
      />
    );
  }

  const recurringTransactions = data?.recurringTransactions ?? [];

  if (recurringTransactions.length === 0) {
    return (
      <EmptyState
        icon={<Schedule />}
        title="No Recurring Transactions"
        description="Click the + button to add a recurring transaction."
      />
    );
  }

  return (
    <Box>
      <Card>
        <List disablePadding>
          {recurringTransactions.map((transaction, index) => {
            const recurringType = getRecurringTypeFromCron(transaction.cronExpression);
            const typeLabel = recurringType
              ? getRecurringTypeOptions().find((opt) => opt.value === recurringType)?.label ?? 'Custom'
              : 'Custom';

            return (
              <React.Fragment key={transaction.id}>
                {index > 0 && <Divider />}
                <ListItem sx={{py: 1.5, px: 2}}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{width: '100%'}}>
                    <Stack spacing={0.5} sx={{flex: 1}}>
                      <Typography variant="body1" fontWeight={500}>
                        {formatCurrencyPreserveDecimals(transaction.value, currency)}
                      </Typography>
                      {transaction.account && (
                        <Typography variant="body2" color="text.secondary">
                          Account: {transaction.account.name}
                        </Typography>
                      )}
                      {transaction.category && (
                        <Typography variant="body2" color="text.secondary">
                          Category: {transaction.category.name}
                        </Typography>
                      )}
                      {transaction.payee && (
                        <Typography variant="body2" color="text.secondary">
                          Payee: {transaction.payee.name}
                        </Typography>
                      )}
                      {transaction.note && (
                        <Typography variant="body2" color="text.secondary">
                          Note: {transaction.note}
                        </Typography>
                      )}
                    </Stack>
                    <Stack spacing={1} alignItems="flex-end">
                      <Chip label={typeLabel} size="small" color="primary" variant="outlined" />
                      <Typography variant="body2" color="text.secondary">
                        Next: {formatDateShort(transaction.nextRunDate, dateFormat)}
                      </Typography>
                    </Stack>
                  </Stack>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      </Card>
    </Box>
  );
}


