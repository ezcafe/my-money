/**
 * Payee Details Page
 * Shows payee details with paginated transactions
 */

import React, {useState, memo, useCallback, useEffect, useRef} from 'react';
import {useParams, useNavigate, useLocation} from 'react-router';
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
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {usePayee} from '../hooks/usePayee';
import {useTransactions, type TransactionOrderInput} from '../hooks/useTransactions';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {ITEMS_PER_PAGE} from '../utils/constants';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {DELETE_TRANSACTION} from '../graphql/mutations';
import {GET_PREFERENCES} from '../graphql/queries';
import {useSearch} from '../contexts/SearchContext';
import {useTitle} from '../contexts/TitleContext';

/**
 * Payee Details Page Component
 */
const PayeeDetailsPageComponent = (): React.JSX.Element => {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef<string>(location.pathname);
  const [page, setPage] = useState(1);
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // Sorting state
  const [sortField, setSortField] = useState<'date' | 'value' | 'category' | 'payee'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; transactionId: string} | null>(
    null,
  );

  // Delete state
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  // Search state
  const {searchQuery, clearSearch} = useSearch();
  const isSearchMode = Boolean(searchQuery);

  // Title state
  const {setTitle} = useTitle();

  // Get currency preference
  const {data: preferencesData} = useQuery<{preferences?: {currency: string}}>(GET_PREFERENCES);
  const currency = preferencesData?.preferences?.currency ?? 'USD';

  // Build orderBy object
  const orderBy: TransactionOrderInput | undefined =
    sortField && sortDirection
      ? {field: sortField, direction: sortDirection}
      : undefined;

  const {payee, loading: payeeLoading, error: payeeError, refetch: refetchPayee} =
    usePayee(id);
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions(undefined, undefined, id, skip, ITEMS_PER_PAGE, orderBy, searchQuery || undefined);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Set appbar title when payee is loaded
  useEffect(() => {
    if (payee) {
      setTitle(payee.name);
    }
    // Cleanup: clear title when component unmounts
    return (): void => {
      setTitle(undefined);
    };
  }, [payee, setTitle]);

  const [deleteTransaction, {loading: deleting}] = useMutation(DELETE_TRANSACTION, {
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetPayee'],
    awaitRefetchQueries: true,
    onCompleted: () => {
      setDeletingTransactionId(null);
      void refetchTransactions();
      void refetchPayee();
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
   * Handle edit click - navigate to edit page
   */
  const handleEdit = useCallback(() => {
    if (menuAnchor && id) {
      const transactionId = menuAnchor.transactionId;
      const returnTo = `/payees/${id}`;
      void navigate(`/transactions/${transactionId}/edit?returnTo=${encodeURIComponent(returnTo)}`);
      handleMenuClose();
    }
  }, [menuAnchor, id, navigate, handleMenuClose]);

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

  // Refetch data when returning from edit page
  useEffect(() => {
    // If we navigated back from a different path (e.g., from edit page), refetch data
    if (prevLocationRef.current !== location.pathname && prevLocationRef.current.includes('/transactions/')) {
      void refetchTransactions();
      void refetchPayee();
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, refetchTransactions, refetchPayee]);

  /**
   * Get sort icon for column
   */
  const getSortIcon = (field: 'date' | 'value' | 'category' | 'payee'): React.ReactNode => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  // Show full-page loading only when payee is loading (initial load)
  if (payeeLoading) {
    return <LoadingSpinner message="Loading payee details..." />;
  }

  if (payeeError) {
    return (
      <ErrorAlert
        title="Error Loading Payee"
        message={payeeError?.message ?? 'Error loading payee details'}
      />
    );
  }

  if (!payee) {
    return (
      <ErrorAlert
        title="Payee Not Found"
        message="The requested payee could not be found."
        severity="warning"
      />
    );
  }

  // Show transaction error if any
  if (transactionsError) {
    return (
      <Box sx={{p: 2}}>
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
      <Card sx={{mt: 3, p: 0}}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0, pb: 1}}>
          <Typography variant="h6" component="h2" gutterBottom sx={{mb: 0}}>
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
                    <TableCell>Account</TableCell>
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
                        <TableCell>{formatCurrencyPreserveDecimals(transaction.value, currency)}</TableCell>
                        <TableCell>{transaction.account?.name ?? '-'}</TableCell>
                        <TableCell>{transaction.category?.name ?? '-'}</TableCell>
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

PayeeDetailsPageComponent.displayName = 'PayeeDetailsPage';

export const PayeeDetailsPage = memo(PayeeDetailsPageComponent);

