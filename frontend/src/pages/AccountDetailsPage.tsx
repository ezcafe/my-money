/**
 * Account Details Page
 * Shows account details with paginated transactions and charts
 */

import React, {useState, memo, useCallback, useEffect} from 'react';
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
  IconButton,
  Menu,
  MenuItem,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  CircularProgress,
} from '@mui/material';
import {MoreVert, Edit, Delete, ArrowUpward, ArrowDownward, Clear} from '@mui/icons-material';
import {useMutation} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {useAccount} from '../hooks/useAccount';
import {useTransactions, type TransactionOrderInput, type Transaction} from '../hooks/useTransactions';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {ITEMS_PER_PAGE} from '../utils/constants';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {TransactionEditDialog} from '../components/TransactionEditDialog';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {useSearch} from '../contexts/SearchContext';
import {useTitle} from '../contexts/TitleContext';

/**
 * Account Details Page Component
 */
const AccountDetailsPageComponent = (): React.JSX.Element => {
  const {id} = useParams<{id: string}>();
  const [page, setPage] = useState(1);
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // Sorting state
  const [sortField, setSortField] = useState<'date' | 'value' | 'category' | 'payee'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; transactionId: string} | null>(
    null,
  );

  // Edit/Delete state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  // Search state
  const {searchQuery, clearSearch} = useSearch();
  const isSearchMode = Boolean(searchQuery);
  
  // Title state
  const {setTitle} = useTitle();

  // Build orderBy object
  const orderBy: TransactionOrderInput | undefined =
    sortField && sortDirection
      ? {field: sortField, direction: sortDirection}
      : undefined;

  const {account, loading: accountLoading, error: accountError, refetch: refetchAccount} =
    useAccount(id);
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions(id, skip, ITEMS_PER_PAGE, orderBy, searchQuery || undefined);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);
  
  // Set appbar title when account is loaded
  useEffect(() => {
    if (account) {
      setTitle(account.name);
    }
    // Cleanup: clear title when component unmounts
    return () => {
      setTitle(undefined);
    };
  }, [account, setTitle]);

  const [deleteTransaction, {loading: deleting}] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetAccount'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      setDeletingTransactionId(null);
      void refetchTransactions();
      void refetchAccount();
    },
  });

  /**
   * Handle sort column click
   */
  const handleSort = useCallback(
    (field: 'date' | 'value' | 'category' | 'payee') => {
      if (sortField === field) {
        // Toggle direction if same field
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // Set new field with default direction
        setSortField(field);
        setSortDirection('desc');
      }
      setPage(1); // Reset to first page when sorting changes
    },
    [sortField, sortDirection],
  );

  /**
   * Handle menu open
   */
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, transactionId: string) => {
    setMenuAnchor({element: event.currentTarget, transactionId});
  }, []);

  /**
   * Handle menu close
   */
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle edit click
   */
  const handleEdit = useCallback(() => {
    if (menuAnchor) {
      const transaction = transactions.items.find((t) => t.id === menuAnchor.transactionId);
      if (transaction) {
        setEditingTransaction(transaction);
      }
      handleMenuClose();
    }
  }, [menuAnchor, transactions.items, handleMenuClose]);

  /**
   * Handle delete click
   */
  const handleDeleteClick = useCallback(() => {
    if (menuAnchor) {
      setDeletingTransactionId(menuAnchor.transactionId);
      handleMenuClose();
    }
  }, [menuAnchor, handleMenuClose]);

  /**
   * Handle delete confirmation
   */
  const handleDeleteConfirm = useCallback(() => {
    if (deletingTransactionId) {
      void deleteTransaction({
        variables: {id: deletingTransactionId},
      });
    }
  }, [deletingTransactionId, deleteTransaction]);

  /**
   * Handle edit dialog close
   */
  const handleEditClose = useCallback(() => {
    setEditingTransaction(null);
  }, []);

  /**
   * Handle edit success
   */
  const handleEditSuccess = useCallback(() => {
    void refetchTransactions();
    void refetchAccount();
  }, [refetchTransactions, refetchAccount]);

  /**
   * Get sort icon for column
   */
  const getSortIcon = (field: 'date' | 'value' | 'category' | 'payee') => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  // Show full-page loading only when account is loading (initial load)
  if (accountLoading) {
    return <LoadingSpinner message="Loading account details..." />;
  }

  if (accountError) {
    return (
      <ErrorAlert
        title="Error Loading Account"
        message={accountError?.message ?? 'Error loading account details'}
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

  // Show transaction error if any
  if (transactionsError) {
    return (
      <Box sx={{p: 2, width: '100%'}}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {`Balance`}
            </Typography>
            <Typography variant="h2" color="primary" gutterBottom>
              {formatCurrencyPreserveDecimals(account.balance)}
            </Typography>
          </Box>
        </Box>
        <ErrorAlert
          title="Error Loading Transactions"
          message={transactionsError?.message ?? 'Error loading transactions'}
        />
      </Box>
    );
  }

  const totalPages = Math.ceil(transactions.totalCount / ITEMS_PER_PAGE);

  return (
    <Box sx={{p: 2, width: '100%'}}>
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {`Balance`}
          </Typography>
          <Typography variant="h2" color="primary" gutterBottom>
            {formatCurrencyPreserveDecimals(account.balance)}
          </Typography>
        </Box>
      </Box>

      <Card sx={{mt: 3, p: 0}}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0, pb: 1}}>
          <Typography variant="h6" gutterBottom sx={{mb: 0}}>
            {isSearchMode ? `Search Results (${transactions.totalCount})` : 'Transactions'}
          </Typography>
          {isSearchMode && (
            <Button
              startIcon={<Clear />}
              onClick={clearSearch}
              variant="outlined"
              size="small"
            >
              Clear Search
            </Button>
          )}
        </Box>
        {transactionsLoading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              py: 4,
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'date'}
                        direction={sortField === 'date' ? sortDirection : 'asc'}
                        onClick={() => handleSort('date')}
                        IconComponent={() => getSortIcon('date')}
                      >
                        Date
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'value'}
                        direction={sortField === 'value' ? sortDirection : 'asc'}
                        onClick={() => handleSort('value')}
                        IconComponent={() => getSortIcon('value')}
                      >
                        Value
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'category'}
                        direction={sortField === 'category' ? sortDirection : 'asc'}
                        onClick={() => handleSort('category')}
                        IconComponent={() => getSortIcon('category')}
                      >
                        Category
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'payee'}
                        direction={sortField === 'payee' ? sortDirection : 'asc'}
                        onClick={() => handleSort('payee')}
                        IconComponent={() => getSortIcon('payee')}
                      >
                        Payee
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Note</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {isSearchMode ? 'No transactions found matching your search.' : 'No transactions found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.items.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{formatDateShort(transaction.date)}</TableCell>
                        <TableCell>{formatCurrencyPreserveDecimals(transaction.value)}</TableCell>
                        <TableCell>{transaction.category?.name ?? '-'}</TableCell>
                        <TableCell>{transaction.payee?.name ?? '-'}</TableCell>
                        <TableCell>{transaction.note ?? '-'}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, transaction.id)}
                            aria-label="More actions"
                          >
                            <MoreVert />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Box sx={{display: 'flex', justifyContent: 'center', mt: 2, pb: 2}}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                />
              </Box>
            )}
          </>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor?.element ?? null}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit fontSize="small" sx={{mr: 1}} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <Delete fontSize="small" sx={{mr: 1}} />
          Delete
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      {editingTransaction && (
        <TransactionEditDialog
          open={Boolean(editingTransaction)}
          transaction={editingTransaction}
          onClose={handleEditClose}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingTransactionId)}
        onClose={() => setDeletingTransactionId(null)}
      >
        <DialogTitle>Delete Transaction</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this transaction? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingTransactionId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

AccountDetailsPageComponent.displayName = 'AccountDetailsPage';

export const AccountDetailsPage = memo(AccountDetailsPageComponent);
