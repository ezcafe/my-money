/**
 * History List Component
 * Shows last 30 transactions with green circle indicator for incomplete entries
 */

import React, {memo, useMemo} from 'react';
import {List, ListItem, ListItemButton, ListItemText, Avatar, Box, Typography} from '@mui/material';
import {Circle} from '@mui/icons-material';
import {Card} from './ui/Card';
import {formatCurrency, formatDate} from '../utils/formatting';

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
 * Displays last 30 transactions with green circle for incomplete entries
 */
const HistoryListComponent = ({
  transactions,
  onTransactionClick,
}: HistoryListProps): React.JSX.Element => {
  const isIncomplete = useMemo(
    () => (transaction: Transaction): boolean => {
      return !transaction.account || !transaction.category || !transaction.payee;
    },
    [],
  );

  return (
    <Card>
      <Box sx={{p: 2}}>
        <Typography variant="h6" gutterBottom>
          Recent Transactions
        </Typography>
        <List>
          {transactions.length === 0 ? (
            <ListItem>
              <ListItemText primary="No transactions yet" />
            </ListItem>
          ) : (
            transactions.map((transaction) => (
              <ListItemButton
                key={transaction.id}
                onClick={() => onTransactionClick?.(transaction)}
                sx={{
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                {isIncomplete(transaction) && (
                  <Avatar
                    sx={{
                      width: 8,
                      height: 8,
                      bgcolor: 'success.main',
                      mr: 1,
                    }}
                  >
                    <Circle sx={{fontSize: 8}} />
                  </Avatar>
                )}
                <ListItemText
                  primary={formatCurrency(transaction.value)}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(transaction.date)}
                      </Typography>
                      {transaction.account && (
                        <Typography variant="caption" color="text.secondary">
                          {transaction.account.name}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Box>
    </Card>
  );
};

HistoryListComponent.displayName = 'HistoryList';

export const HistoryList = memo(HistoryListComponent);


