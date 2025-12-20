/**
 * Account Details Page
 * Shows account details with paginated transactions and charts
 */

import React, {useState, memo} from 'react';
import {useParams} from 'react-router';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
} from '@mui/material';
import {Card} from '../components/ui/Card';
import {useAccount} from '../hooks/useAccount';
import {useTransactions} from '../hooks/useTransactions';
import {formatCurrency, formatDateShort} from '../utils/formatting';
import {ITEMS_PER_PAGE} from '../utils/constants';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';

/**
 * Account Details Page Component
 */
const AccountDetailsPageComponent = (): React.JSX.Element => {
  const {id} = useParams<{id: string}>();
  const [page, setPage] = useState(1);
  const skip = (page - 1) * ITEMS_PER_PAGE;

  const {account, loading: accountLoading, error: accountError} = useAccount(id);
  const {transactions, loading: transactionsLoading, error: transactionsError} = useTransactions(
    id,
    skip,
    ITEMS_PER_PAGE,
  );

  if (accountLoading || transactionsLoading) {
    return <LoadingSpinner message="Loading account details..." />;
  }

  if (accountError || transactionsError) {
    return (
      <ErrorAlert
        title="Error Loading Account"
        message={accountError?.message ?? transactionsError?.message ?? 'Error loading account details'}
      />
    );
  }

  if (!account) {
    return (
      <ErrorAlert
        title="Account Not Found"
        message="The requested account could not be found."
        severity="warning"
      />
    );
  }

  const totalPages = Math.ceil(transactions.totalCount / ITEMS_PER_PAGE);

  return (
    <Box sx={{p: 2, width: '100%'}}>
      <Typography variant="h4" gutterBottom>
        {account.name}
      </Typography>
      <Typography variant="h5" color="primary" gutterBottom>
        Balance: {formatCurrency(account.balance)}
      </Typography>

      <Card sx={{mt: 3, p: 2}}>
        <Typography variant="h6" gutterBottom>
          Transactions
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Payee</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.items.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDateShort(transaction.date)}</TableCell>
                  <TableCell>{formatCurrency(transaction.value)}</TableCell>
                  <TableCell>{transaction.category?.name ?? '-'}</TableCell>
                  <TableCell>{transaction.payee?.name ?? '-'}</TableCell>
                  <TableCell>{transaction.note ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {totalPages > 1 && (
          <Box sx={{display: 'flex', justifyContent: 'center', mt: 2}}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
            />
          </Box>
        )}
      </Card>
    </Box>
  );
};

AccountDetailsPageComponent.displayName = 'AccountDetailsPage';

export const AccountDetailsPage = memo(AccountDetailsPageComponent);


