/**
 * History List Component
 * Shows last 30 transactions with category and payee information
 */

import React, { memo, useMemo } from 'react';
import { List, ListItemButton, ListItemText, Box, Typography } from '@mui/material';
import { useQuery } from '@apollo/client/react';
import { Card } from './ui/Card';
import {
  formatCurrencyPreserveDecimals,
  groupTransactionsByDate,
  formatDateHeader,
  getDateKey,
} from '../utils/formatting';
import { GET_PREFERENCES } from '../graphql/queries';
import { useDateFormat } from '../hooks/useDateFormat';

interface Transaction {
  id: string;
  value: number;
  date: Date;
  account?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  payee?: { id: string; name: string } | null;
  note?: string | null;
}

interface HistoryListProps {
  transactions: Transaction[];
  onTransactionClick?: (transaction: Transaction) => void;
}

/**
 * History List Component
 * Displays last 30 transactions with category and payee information, grouped by date
 */
const HistoryListComponent = ({
  transactions,
  onTransactionClick,
}: HistoryListProps): React.JSX.Element => {
  const { data: preferencesData } = useQuery<{ preferences?: { currency: string } }>(
    GET_PREFERENCES
  );
  const currency = preferencesData?.preferences?.currency ?? 'USD';
  const { dateFormat } = useDateFormat();

  // Group transactions by date and preserve order
  const { groupedTransactions, dateKeys } = useMemo(() => {
    const grouped = groupTransactionsByDate(transactions);
    // Preserve the order of dates based on first occurrence in transactions array
    const seenDates = new Set<string>();
    const orderedKeys: string[] = [];

    for (const transaction of transactions) {
      const dateKey = getDateKey(transaction.date);

      if (!seenDates.has(dateKey)) {
        seenDates.add(dateKey);
        orderedKeys.push(dateKey);
      }
    }

    return { groupedTransactions: grouped, dateKeys: orderedKeys };
  }, [transactions]);

  return (
    <Card>
      <Box>
        <List>
          {dateKeys.map((dateKey) => {
            const dateTransactions = groupedTransactions.get(dateKey) ?? [];
            // Get the date from the first transaction in the group
            const date = dateTransactions[0]?.date;
            const dateHeader = date ? formatDateHeader(date, dateFormat) : '';

            return (
              <React.Fragment key={dateKey}>
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    backgroundColor: 'background.default',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {dateHeader}
                  </Typography>
                  <Box
                    sx={{
                      ml: '10px',
                      flex: 1,
                      backgroundColor: 'divider',
                    }}
                  />
                </Box>
                {dateTransactions.map((transaction) => (
                  <ListItemButton
                    key={transaction.id}
                    onClick={() => onTransactionClick?.(transaction)}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <ListItemText
                      primary={transaction.category?.name ?? ''}
                      secondary={transaction.payee?.name ?? undefined}
                      sx={{ flex: '0 1 auto' }}
                    />
                    <Typography
                      variant="body1"
                      sx={{
                        flexShrink: 0,
                        ml: 2,
                        textAlign: 'right',
                      }}
                    >
                      {formatCurrencyPreserveDecimals(transaction.value, currency)}
                    </Typography>
                  </ListItemButton>
                ))}
              </React.Fragment>
            );
          })}
        </List>
      </Box>
    </Card>
  );
};

HistoryListComponent.displayName = 'HistoryList';

export const HistoryList = memo(HistoryListComponent);
