/**
 * Schedule Page
 * Manage recurring transactions
 */

import React, {useEffect} from 'react';
import {useLocation} from 'react-router';
import {Box, Typography, List, ListItem, Chip} from '@mui/material';
import {useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {GET_RECURRING_TRANSACTIONS, GET_PREFERENCES} from '../graphql/queries';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {getRecurringTypeOptions, type RecurringType} from '../utils/recurringTypes';

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
    icon?: string | null;
  } | null;
  payeeId: string | null;
  payee: {
    id: string;
    name: string;
    icon?: string | null;
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
      <Box sx={{width: '100%'}}>
        <Card sx={{p: 2}}>
          <Typography variant="body2" color="text.secondary">
            No recurring transactions. Click the + button to add one.
          </Typography>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{width: '100%'}}>
      <Card>
        <List>
          {recurringTransactions.map((transaction) => {
            const recurringType = getRecurringTypeFromCron(transaction.cronExpression);
            const typeLabel = recurringType
              ? getRecurringTypeOptions().find((opt) => opt.value === recurringType)?.label ?? 'Custom'
              : 'Custom';

            return (
              <ListItem
                key={transaction.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 1,
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
                  <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1}}>
                    <Typography variant="body1" fontWeight="medium">
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
                  </Box>
                  <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1}}>
                    <Chip label={typeLabel} size="small" color="primary" />
                    <Typography variant="body2" color="text.secondary">
                      Next: {formatDateShort(transaction.nextRunDate)}
                    </Typography>
                  </Box>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Card>
    </Box>
  );
}


