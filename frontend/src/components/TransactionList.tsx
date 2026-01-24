/**
 * Transaction List Component
 * Reusable component for displaying paginated, sortable transaction tables
 * Used in Account, Category, Payee, and Budget detail pages
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  useMediaQuery,
  useTheme,
  Stack,
} from '@mui/material';
import { MoreVert, Edit, Delete, ArrowUpward, ArrowDownward, Clear } from '@mui/icons-material';
import { FixedSizeList } from 'react-window';
import { Card } from './ui/Card';
import type { PaginatedTransactions, TransactionOrderByField } from '../hooks/useTransactions';
import { formatCurrencyPreserveDecimals, formatDateShort } from '../utils/formatting';
import { ITEMS_PER_PAGE } from '../constants';
import { useDateFormat } from '../hooks/useDateFormat';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { dateFormat } = useDateFormat();

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{
    element: HTMLElement;
    transactionId: string;
  } | null>(null);

  // Delete state
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  /**
   * Handle menu open
   */
  const handleMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>, transactionId: string) => {
      setMenuAnchor({ element: event.currentTarget, transactionId });
    },
    []
  );

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
   * Handle sort field change
   */
  const handleSortFieldChange = useCallback(
    (field: TransactionOrderByField) => {
      onSortChange(field, sortDirection);
    },
    [sortDirection, onSortChange]
  );

  /**
   * Handle sort direction toggle
   */
  const handleSortDirectionToggle = useCallback(() => {
    onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc');
  }, [sortField, sortDirection, onSortChange]);

  /**
   * Get field label for display
   */
  const getFieldLabel = (field: TransactionOrderByField): string => {
    const labels: Record<TransactionOrderByField, string> = {
      date: 'Date',
      value: 'Value',
      account: 'Account',
      category: 'Category',
      payee: 'Payee',
    };
    return labels[field];
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

  /**
   * Render transaction row (memoized for virtual scrolling)
   */
  const renderTransactionRow = useCallback(
    (transaction: (typeof transactions.items)[0], _index: number) => (
      <TableRow
        key={transaction.id}
        hover={Boolean(onRowClick)}
        sx={onRowClick ? { cursor: 'pointer' } : undefined}
        onClick={onRowClick ? (): void => onRowClick(transaction.id) : undefined}
      >
        <TableCell>{formatDateShort(transaction.date, dateFormat)}</TableCell>
        <TableCell>{formatCurrencyPreserveDecimals(transaction.value, currency)}</TableCell>
        {showAccountColumn ? <TableCell>{transaction.account?.name ?? '-'}</TableCell> : null}
        {showCategoryColumn ? <TableCell>{transaction.category?.name ?? '-'}</TableCell> : null}
        {showPayeeColumn ? <TableCell>{transaction.payee?.name ?? '-'}</TableCell> : null}
        <TableCell>{transaction.note ?? '-'}</TableCell>
        <TableCell
          align="right"
          onClick={(e) => e.stopPropagation()}
          sx={{
            '@media print': {
              display: 'none',
            },
          }}
        >
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
    ),
    [
      currency,
      dateFormat,
      showAccountColumn,
      showCategoryColumn,
      showPayeeColumn,
      onRowClick,
      handleMenuOpen,
      transactions,
    ]
  );

  /**
   * Virtualized table rows component for large lists
   * Uses react-window for efficient rendering of large transaction lists
   */
  const VirtualizedTableRows = useMemo(() => {
    const ROW_HEIGHT = 53;
    const items = transactions.items;
    const CONTAINER_HEIGHT = Math.min(600, items.length * ROW_HEIGHT);

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const transaction = items[index];
      if (!transaction) return null;
      return (
        <Box component="div" style={style}>
          {renderTransactionRow(transaction, index)}
        </Box>
      );
    };

    return (
      <Box sx={{ height: CONTAINER_HEIGHT, overflow: 'auto' }}>
        <FixedSizeList
          height={CONTAINER_HEIGHT}
          itemCount={items.length}
          itemSize={ROW_HEIGHT}
          width="100%"
        >
          {Row}
        </FixedSizeList>
      </Box>
    );
  }, [transactions.items, renderTransactionRow]);

  /**
   * Render sort controls
   */
  const renderSortControls = (): React.ReactNode => {
    const availableFields = sortableFields.filter((field) => {
      if (field === 'account' && !showAccountColumn) return false;
      if (field === 'category' && !showCategoryColumn) return false;
      if (field === 'payee' && !showPayeeColumn) return false;
      return true;
    });

    return (
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          p: 2,
          pb: isMobile ? 1 : 2,
          borderBottom: isMobile ? 1 : 0,
          borderColor: 'divider',
          '@media print': {
            display: 'none',
          },
        }}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sort by</InputLabel>
          <Select
            value={sortField}
            label="Sort by"
            onChange={(e) => handleSortFieldChange(e.target.value as TransactionOrderByField)}
          >
            {availableFields.map((field) => (
              <MenuItem key={field} value={field}>
                {getFieldLabel(field)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton
          size="small"
          onClick={handleSortDirectionToggle}
          aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
        >
          {sortDirection === 'asc' ? <ArrowUpward /> : <ArrowDownward />}
        </IconButton>
      </Box>
    );
  };

  /**
   * Render card-based layout for mobile
   */
  const renderCardLayout = (): React.ReactNode => {
    if (transactions.items.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {isSearchMode
              ? 'No transactions found matching your search.'
              : 'No transactions found.'}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1, sm: 2 } }}>
        {transactions.items.map((transaction) => (
          <Card
            key={transaction.id}
            onClick={onRowClick ? (): void => onRowClick(transaction.id) : undefined}
            sx={{
              p: 2,
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '&:hover': onRowClick
                ? {
                    backgroundColor: 'action.hover',
                    transform: 'translateY(-2px)',
                    boxShadow: 2,
                  }
                : {},
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 0.5,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {formatDateShort(transaction.date, dateFormat)}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {formatCurrencyPreserveDecimals(transaction.value, currency)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuOpen(e, transaction.id);
                }}
                aria-label="More actions"
                sx={{
                  '@media print': {
                    display: 'none',
                  },
                }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </Box>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {showAccountColumn && transaction.account ? (
                <Typography variant="caption" color="text.secondary">
                  Account: {transaction.account.name}
                </Typography>
              ) : null}
              {showCategoryColumn && transaction.category ? (
                <Typography variant="caption" color="text.secondary">
                  Category: {transaction.category.name}
                </Typography>
              ) : null}
              {showPayeeColumn && transaction.payee ? (
                <Typography variant="caption" color="text.secondary">
                  Payee: {transaction.payee.name}
                </Typography>
              ) : null}
              {transaction.note ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Note: {transaction.note}
                </Typography>
              ) : null}
            </Stack>
          </Card>
        ))}
      </Box>
    );
  };

  // Show error if any
  if (error) {
    return (
      <Card sx={{ mt: 3, p: 2 }}>
        <Typography variant="body1" color="error">
          Error loading transactions: {error.message}
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ mt: 3, p: 0 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          pb: 1,
          '@media print': {
            display: 'none',
          },
        }}
      >
        <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 0 }}>
          {isSearchMode
            ? `Search Results (${transactions.totalCount.toLocaleString()})`
            : `${transactions.totalCount.toLocaleString()} Transactions`}
        </Typography>
        {isSearchMode && onClearSearch ? (
          <Button startIcon={<Clear />} onClick={onClearSearch} variant="outlined" size="small">
            Clear Search
          </Button>
        ) : null}
      </Box>
      {renderSortControls()}
      {loading ? (
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
          {isMobile ? (
            renderCardLayout()
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Value</TableCell>
                    {showAccountColumn ? <TableCell>Account</TableCell> : null}
                    {showCategoryColumn ? <TableCell>Category</TableCell> : null}
                    {showPayeeColumn ? <TableCell>Payee</TableCell> : null}
                    <TableCell>Note</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        '@media print': {
                          display: 'none',
                        },
                      }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={getEmptyStateColSpan()} align="center">
                        {isSearchMode
                          ? 'No transactions found matching your search.'
                          : 'No transactions found.'}
                      </TableCell>
                    </TableRow>
                  ) : transactions.items.length > 50 ? (
                    // Use virtual scrolling for large lists (>50 items)
                    VirtualizedTableRows
                  ) : (
                    // Render normally for smaller lists
                    transactions.items.map((transaction, index) =>
                      renderTransactionRow(transaction, index)
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {totalPages > 1 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 2,
                pb: 2,
                '@media print': {
                  display: 'none',
                },
              }}
            >
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
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deletingTransactionId)} onClose={() => setDeletingTransactionId(null)}>
        <DialogTitle>Delete Transaction</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this transaction? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingTransactionId(null)}>Cancel</Button>
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
