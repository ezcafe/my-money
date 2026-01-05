/**
 * Transaction List Component
 * Reusable component for displaying paginated, sortable transaction tables
 * Used in Account, Category, Payee, and Budget detail pages
 */

import React, {useState, useCallback, memo} from 'react';
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
} from '@mui/material';
import {MoreVert, Edit, Delete, ArrowUpward, ArrowDownward, Clear} from '@mui/icons-material';
import {Card} from './ui/Card';
import {SkeletonLoader} from './common/SkeletonLoader';
import type {
  PaginatedTransactions,
  TransactionOrderByField,
} from '../hooks/useTransactions';
import {formatCurrencyPreserveDecimals, formatDateShort} from '../utils/formatting';
import {ITEMS_PER_PAGE} from '../utils/constants';

/**
 * Props for TransactionList component
 */
export interface TransactionListProps {
  /** Paginated transactions data */
  transactions: PaginatedTransactions;
  /** Loading state */
  loading: boolean;
  /** Optional error state */
  error?: Error;
  /** Currency code for formatting */
  currency: string;
  /** Current page number (1-based) */
  page: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Current sort field */
  sortField: TransactionOrderByField;
  /** Current sort direction */
  sortDirection: 'asc' | 'desc';
  /** Callback when sort changes */
  onSortChange: (field: TransactionOrderByField, direction: 'asc' | 'desc') => void;
  /** Callback when edit is clicked */
  onEdit: (transactionId: string) => void;
  /** Callback when delete is clicked */
  onDelete: (transactionId: string) => void;
  /** Whether search mode is active */
  isSearchMode: boolean;
  /** Optional callback to clear search */
  onClearSearch?: () => void;
  /** Whether to show Account column */
  showAccountColumn?: boolean;
  /** Whether to show Category column */
  showCategoryColumn?: boolean;
  /** Whether to show Payee column */
  showPayeeColumn?: boolean;
  /** Array of sortable fields (defaults to all fields) */
  sortableFields?: TransactionOrderByField[];
  /** Optional callback when row is clicked */
  onRowClick?: (transactionId: string) => void;
}

/**
 * TransactionList Component
 * Displays a paginated, sortable table of transactions with edit/delete actions
 */
const TransactionListComponent: React.FC<TransactionListProps> = ({
  transactions,
  loading,
  error,
  currency,
  page,
  onPageChange,
  sortField,
  sortDirection,
  onSortChange,
  onEdit,
  onDelete,
  isSearchMode,
  onClearSearch,
  showAccountColumn = true,
  showCategoryColumn = true,
  showPayeeColumn = true,
  sortableFields = ['date', 'value', 'account', 'category', 'payee'],
  onRowClick,
}) => {
  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{element: HTMLElement; transactionId: string} | null>(
    null,
  );

  // Delete state
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

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
      onEdit(menuAnchor.transactionId);
      handleMenuClose();
    }
  }, [menuAnchor, onEdit, handleMenuClose]);

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
      onDelete(deletingTransactionId);
      setDeletingTransactionId(null);
    }
  }, [deletingTransactionId, onDelete]);

  /**
   * Handle sort column click
   */
  const handleSort = useCallback(
    (field: TransactionOrderByField) => {
      if (sortField === field) {
        // Toggle direction if same field
        onSortChange(field, sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // Set new field with default direction
        onSortChange(field, 'desc');
      }
    },
    [sortField, sortDirection, onSortChange],
  );

  /**
   * Get sort icon for column
   */
  const getSortIcon = (field: TransactionOrderByField): React.ReactNode => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  /**
   * Check if field is sortable
   */
  const isSortable = (field: TransactionOrderByField): boolean => {
    return sortableFields.includes(field);
  };

  /**
   * Calculate total pages
   */
  const totalPages = Math.ceil(transactions.totalCount / ITEMS_PER_PAGE);

  /**
   * Calculate column span for empty state
   */
  const getEmptyStateColSpan = (): number => {
    let count = 2; // Date and Value are always shown
    if (showAccountColumn) count++;
    if (showCategoryColumn) count++;
    if (showPayeeColumn) count++;
    count += 2; // Note and Actions
    return count;
  };

  // Show error if any
  if (error) {
    return (
      <Card sx={{mt: 3, p: 2}}>
        <Typography variant="body1" color="error">
          Error loading transactions: {error.message}
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{mt: 3, p: 0}}>
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 1}}>
        <Typography variant="h6" component="h2" gutterBottom sx={{mb: 0}}>
          {isSearchMode ? `Search Results (${transactions.totalCount})` : 'Transactions'}
        </Typography>
        {isSearchMode && onClearSearch && (
          <Button
            startIcon={<Clear />}
            onClick={onClearSearch}
            variant="outlined"
            size="small"
          >
            Clear Search
          </Button>
        )}
      </Box>
      {loading ? (
        <Box sx={{p: 2}}>
          <SkeletonLoader variant="table" count={5} />
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    {isSortable('date') ? (
                      <TableSortLabel
                        active={sortField === 'date'}
                        direction={sortField === 'date' ? sortDirection : 'asc'}
                        onClick={() => handleSort('date')}
                        IconComponent={() => getSortIcon('date')}
                      >
                        Date
                      </TableSortLabel>
                    ) : (
                      'Date'
                    )}
                  </TableCell>
                  <TableCell>
                    {isSortable('value') ? (
                      <TableSortLabel
                        active={sortField === 'value'}
                        direction={sortField === 'value' ? sortDirection : 'asc'}
                        onClick={() => handleSort('value')}
                        IconComponent={() => getSortIcon('value')}
                      >
                        Value
                      </TableSortLabel>
                    ) : (
                      'Value'
                    )}
                  </TableCell>
                  {showAccountColumn && (
                    <TableCell>
                      {isSortable('account') ? (
                        <TableSortLabel
                          active={sortField === 'account'}
                          direction={sortField === 'account' ? sortDirection : 'asc'}
                          onClick={() => handleSort('account')}
                          IconComponent={() => getSortIcon('account')}
                        >
                          Account
                        </TableSortLabel>
                      ) : (
                        'Account'
                      )}
                    </TableCell>
                  )}
                  {showCategoryColumn && (
                    <TableCell>
                      {isSortable('category') ? (
                        <TableSortLabel
                          active={sortField === 'category'}
                          direction={sortField === 'category' ? sortDirection : 'asc'}
                          onClick={() => handleSort('category')}
                          IconComponent={() => getSortIcon('category')}
                        >
                          Category
                        </TableSortLabel>
                      ) : (
                        'Category'
                      )}
                    </TableCell>
                  )}
                  {showPayeeColumn && (
                    <TableCell>
                      {isSortable('payee') ? (
                        <TableSortLabel
                          active={sortField === 'payee'}
                          direction={sortField === 'payee' ? sortDirection : 'asc'}
                          onClick={() => handleSort('payee')}
                          IconComponent={() => getSortIcon('payee')}
                        >
                          Payee
                        </TableSortLabel>
                      ) : (
                        'Payee'
                      )}
                    </TableCell>
                  )}
                  <TableCell>Note</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={getEmptyStateColSpan()} align="center" sx={{py: 6}}>
                      <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1}}>
                        <Typography variant="body1" color="text.secondary" sx={{mb: 1}}>
                          {isSearchMode ? 'No transactions found matching your search.' : 'No transactions found.'}
                        </Typography>
                        {isSearchMode && onClearSearch && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={onClearSearch}
                            sx={{textTransform: 'none', mt: 1}}
                          >
                            Clear Search
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.items.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      hover={Boolean(onRowClick)}
                      sx={{
                        ...(onRowClick ? {cursor: 'pointer'} : {}),
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                      onClick={onRowClick ? (): void => onRowClick(transaction.id) : undefined}
                    >
                      <TableCell>{formatDateShort(transaction.date)}</TableCell>
                      <TableCell>{formatCurrencyPreserveDecimals(transaction.value, currency)}</TableCell>
                      {showAccountColumn && <TableCell>{transaction.account?.name ?? '-'}</TableCell>}
                      {showCategoryColumn && <TableCell>{transaction.category?.name ?? '-'}</TableCell>}
                      {showPayeeColumn && <TableCell>{transaction.payee?.name ?? '-'}</TableCell>}
                      <TableCell>{transaction.note ?? '-'}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuOpen(e, transaction.id);
                          }}
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
                onChange={(_, value) => onPageChange(value)}
              />
            </Box>
          )}
        </>
      )}

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
          <Button onClick={() => setDeletingTransactionId(null)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

TransactionListComponent.displayName = 'TransactionList';

export const TransactionList = memo(TransactionListComponent);

