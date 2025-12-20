/**
 * History List Component
 * Shows last 30 transactions with category and payee information
 */

import React, {memo} from 'react';
import {List, ListItemButton, ListItemText, Box, Typography} from '@mui/material';
import {Card} from './ui/Card';
import {formatCurrencyPreserveDecimals} from '../utils/formatting';

interface Transaction {
  id: string;
  value: number;
  date: Date;
  account?: {id: string; name: string} | null;
  category?: {id: string; name: string; icon?: string | null} | null;
  payee?: {id: string; name: string; icon?: string | null} | null;
  note?: string | null;
}

interface HistoryListProps {
  transactions: Transaction[];
  onTransactionClick?: (transaction: Transaction) => void;
}

/**
 * History List Component
 * Displays last 30 transactions with category and payee information
 */
const HistoryListComponent = ({
  transactions,
  onTransactionClick,
}: HistoryListProps): React.JSX.Element => {
  return (
    <Card sx={{p: 0}}>
      <Box>
        <List sx={{backgroundColor: 'transparent', padding: 0}}>
          {transactions.map((transaction) => (
            <ListItemButton
              key={transaction.id}
              onClick={() => onTransactionClick?.(transaction)}
              sx={{
                minHeight: 48,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemText
                primary={transaction.category?.name ?? ''}
                secondary={transaction.payee?.name ?? undefined}
                sx={{flex: '0 1 auto'}}
              />
              <Typography
                variant="body1"
                sx={{
                  flexShrink: 0,
                  ml: 2,
                  textAlign: 'right',
                }}
              >
                {formatCurrencyPreserveDecimals(transaction.value)}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Card>
  );
};

HistoryListComponent.displayName = 'HistoryList';

export const HistoryList = memo(HistoryListComponent);


