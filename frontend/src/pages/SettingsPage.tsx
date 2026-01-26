/**
 * Settings Page
 * Allows user to change currency, toggle 000/decimal, manage categories, payees, schedule, and logout
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import type { InMemoryCache } from '@apollo/client';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { logout } from '../utils/oidc';
import {
  GET_SETTINGS,
  EXPORT_DATA,
  GET_ACCOUNTS,
  GET_CATEGORIES,
  GET_PAYEES,
  GET_RECENT_TRANSACTIONS,
  GET_RECURRING_TRANSACTIONS,
  GET_BUDGETS,
  GET_BUDGET_NOTIFICATIONS,
  GET_TRANSACTIONS,
  GET_REPORT_TRANSACTIONS,
} from '../graphql/queries';
import { IMPORT_CSV, RESET_DATA, ADD_EXAMPLE_DATA } from '../graphql/mutations';
import { GET_WORKSPACES, GET_WORKSPACE_MEMBERS } from '../graphql/workspaceOperations';
import { useAuth } from '../contexts/AuthContext';
import {
  Workspaces,
  AccountBalance,
  Category,
  Person,
  Schedule,
  Upload,
  Download,
  Logout,
  RestartAlt,
  AttachMoney,
  Settings,
  DataObject,
  Security,
} from '@mui/icons-material';
import { useNotifications } from '../contexts/NotificationContext';
import { PageContainer } from '../components/common/PageContainer';
import { WorkspaceSelector } from '../components/WorkspaceSelector';
import { MultiSelect } from '../components/ui/MultiSelect';

/**
 * Export data type from GraphQL
 */
interface ExportData {
  accounts: Array<{
    id: string;
    name: string;
    initBalance: string;
    isDefault: boolean;
  }>;
  categories: Array<{
    id: string;
    name: string;
    type: string;
    isDefault: boolean;
  }>;
  payees: Array<{
    id: string;
    name: string;
    isDefault: boolean;
  }>;
  transactions: Array<{
    id: string;
    value: string;
    date: string;
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    note: string | null;
  }>;
  recurringTransactions: Array<{
    id: string;
    cronExpression: string;
    value: string;
    accountId: string;
    categoryId: string | null;
    payeeId: string | null;
    note: string | null;
    nextRunDate: string;
  }>;
  settings: {
    id: string;
    currency: string;
    useThousandSeparator: boolean;
    colorScheme: string | null;
    colorSchemeValue: string | null;
  } | null;
  budgets: Array<{
    id: string;
    userId: string;
    amount: string;
    currentSpent: string;
    accountId: string | null;
    categoryId: string | null;
    payeeId: string | null;
    lastResetDate: string;
    createdAt: string;
    updatedAt: string;
  }>;
  importMatchRules: Array<{
    id: string;
    pattern: string;
    accountId: string | null;
    categoryId: string | null;
    payeeId: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Export data query result
 */
interface ExportDataQueryResult {
  exportData: ExportData;
}

/**
 * Import CSV mutation result
 */
interface ImportCSVResult {
  importCSV: {
    success: boolean;
    created: number;
    updated: number;
    errors: string[];
  };
}

/**
 * Settings Page Component
 */
export function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showSuccessNotification, showErrorNotification } = useNotifications();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportDataQuery] = useLazyQuery<ExportDataQueryResult>(EXPORT_DATA);

  // Workspace and member filtering for export
  const { data: workspacesData } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    skip: isAuthenticated !== true, // Skip query if not authenticated
  });

  const workspaces = React.useMemo(
    () => workspacesData?.workspaces ?? [],
    [workspacesData?.workspaces]
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Auto-select first workspace if available
  React.useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      const firstWorkspace = workspaces[0];
      if (firstWorkspace) {
        setSelectedWorkspaceId(firstWorkspace.id);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  const { data: membersData } = useQuery<{
    workspaceMembers: Array<{
      id: string;
      userId: string;
      user: {
        id: string;
        email: string;
      };
    }>;
  }>(GET_WORKSPACE_MEMBERS, {
    variables: { workspaceId: selectedWorkspaceId },
    skip: !selectedWorkspaceId,
    fetchPolicy: 'cache-and-network',
  });

  const members = membersData?.workspaceMembers ?? [];
  const [importCSVMutation] = useMutation<ImportCSVResult>(IMPORT_CSV, {
    refetchQueries: [
      { query: GET_ACCOUNTS },
      { query: GET_CATEGORIES },
      { query: GET_PAYEES },
      { query: GET_RECENT_TRANSACTIONS },
      { query: GET_RECURRING_TRANSACTIONS },
      { query: GET_BUDGETS },
      { query: GET_BUDGET_NOTIFICATIONS },
      { query: GET_SETTINGS },
    ],
  });
  const [resetDataMutation, { loading: resetting }] = useMutation(RESET_DATA, {
    refetchQueries: [
      { query: GET_ACCOUNTS },
      { query: GET_CATEGORIES },
      { query: GET_PAYEES },
      { query: GET_RECENT_TRANSACTIONS },
      { query: GET_RECURRING_TRANSACTIONS },
      { query: GET_SETTINGS },
      { query: GET_BUDGETS },
      { query: GET_BUDGET_NOTIFICATIONS },
      { query: GET_TRANSACTIONS },
      { query: GET_REPORT_TRANSACTIONS },
    ],
    awaitRefetchQueries: true,
    update: (cache: InMemoryCache) => {
      // Explicitly clear recentTransactions cache for all variable combinations
      // This ensures the home page shows empty data immediately
      try {
        // Evict all recentTransactions queries from cache
        cache.evict({ fieldName: 'recentTransactions' });
        // Also evict transactions queries
        cache.evict({ fieldName: 'transactions' });
        // Evict reportTransactions
        cache.evict({ fieldName: 'reportTransactions' });
        // Garbage collect to remove orphaned references
        cache.gc();
      } catch (error) {
        // Silently handle cache eviction errors
        console.warn('Cache eviction failed during reset:', error);
      }
    },
  });
  const [addExampleDataMutation, { loading: addingExampleData }] = useMutation(ADD_EXAMPLE_DATA, {
    refetchQueries: [{ query: GET_ACCOUNTS }, { query: GET_CATEGORIES }, { query: GET_PAYEES }],
    awaitRefetchQueries: true,
  });



  /**
   * Handle logout
   * Clears tokens and redirects to login page
   */
  const handleLogout = (): void => {
    void logout();
    void navigate('/login', { replace: true });
  };

  /**
   * Handle reset data button click
   * Opens the reset confirmation dialog
   */
  const handleResetDataClick = (): void => {
    setResetDialogOpen(true);
    setResetConfirmationText('');
  };

  /**
   * Handle reset data confirmation
   * Resets all user data except default entities
   */
  const handleResetData = async (): Promise<void> => {
    try {
      await resetDataMutation();
      setResetDialogOpen(false);
      setResetConfirmationText('');
      showSuccessNotification('All data has been reset successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Reset failed';
      console.error('Reset failed:', error);
      showErrorNotification(`Reset failed: ${errorMessage}`);
    }
  };

  /**
   * Handle add example data
   * Adds example accounts, categories, and payees to the database
   */
  const handleAddExampleData = async (): Promise<void> => {
    try {
      await addExampleDataMutation();
      showSuccessNotification('Example data added successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add example data';
      console.error('Add example data failed:', error);
      showErrorNotification(`Failed to add example data: ${errorMessage}`);
    }
  };

  /**
   * Handle reset dialog close
   * Closes the dialog and resets confirmation text
   */
  const handleResetDialogClose = (): void => {
    if (!resetting) {
      setResetDialogOpen(false);
      setResetConfirmationText('');
    }
  };


  /**
   * Convert array of objects to CSV string
   * @param data - Array of objects to convert
   * @param headers - Array of header names
   * @returns CSV string
   */
  const convertToCSV = (data: Array<Record<string, unknown>>, headers: string[]): string => {
    // Escape CSV values (handle quotes and commas)
    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }
      // Handle objects and arrays by converting to JSON string
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      // Handle string type
      if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }
      // Handle number type
      if (typeof value === 'number') {
        return String(value);
      }
      // Handle boolean type
      if (typeof value === 'boolean') {
        return String(value);
      }
      // Handle symbol type
      if (typeof value === 'symbol') {
        return value.toString();
      }
      // Handle bigint type
      if (typeof value === 'bigint') {
        return value.toString();
      }
      // Fallback - should never reach here, but satisfy TypeScript
      return '';
    };

    // Create header row
    const headerRow = headers.map(escapeCSV).join(',');

    // Create data rows
    const dataRows = data.map((row) => headers.map((header) => escapeCSV(row[header])).join(','));

    return [headerRow, ...dataRows].join('\n');
  };

  /**
   * Download CSV file
   * @param content - CSV content string
   * @param filename - Filename for download
   */
  const downloadCSV = (content: string, filename: string): void => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Handle export button click
   * Fetches all user data and generates CSV files for download
   */
  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const { data } = await exportDataQuery({
        variables: {
          memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
        },
      });
      if (!data?.exportData) {
        return;
      }

      // Close dialog after export starts
      setExportDialogOpen(false);

      const exportData = data.exportData;

      // Export accounts
      if (exportData.accounts && exportData.accounts.length > 0) {
        const accountsCSV = convertToCSV(exportData.accounts, [
          'id',
          'name',
          'initBalance',
          'isDefault',
        ]);
        downloadCSV(accountsCSV, 'my_money_accounts.csv');
      }

      // Export categories
      if (exportData.categories && exportData.categories.length > 0) {
        const categoriesCSV = convertToCSV(exportData.categories, [
          'id',
          'name',
          'type',
          'isDefault',
        ]);
        downloadCSV(categoriesCSV, 'my_money_categories.csv');
      }

      // Export payees
      if (exportData.payees && exportData.payees.length > 0) {
        const payeesCSV = convertToCSV(exportData.payees, ['id', 'name', 'isDefault']);
        downloadCSV(payeesCSV, 'my_money_payees.csv');
      }

      // Export transactions
      if (exportData.transactions && exportData.transactions.length > 0) {
        const transactionsCSV = convertToCSV(exportData.transactions, [
          'id',
          'value',
          'date',
          'accountId',
          'categoryId',
          'payeeId',
          'note',
        ]);
        downloadCSV(transactionsCSV, 'my_money_transactions.csv');
      }

      // Export recurring transactions
      if (exportData.recurringTransactions && exportData.recurringTransactions.length > 0) {
        const recurringCSV = convertToCSV(exportData.recurringTransactions, [
          'id',
          'cronExpression',
          'value',
          'accountId',
          'categoryId',
          'payeeId',
          'note',
          'nextRunDate',
        ]);
        downloadCSV(recurringCSV, 'my_money_recurringTransactions.csv');
      }

      // Export settings
      if (exportData.settings) {
        const settingsCSV = convertToCSV(
          [exportData.settings],
          ['id', 'currency', 'useThousandSeparator', 'colorScheme', 'colorSchemeValue']
        );
        downloadCSV(settingsCSV, 'my_money_settings.csv');
      }

      // Export budgets
      if (exportData.budgets && exportData.budgets.length > 0) {
        const budgetsCSV = convertToCSV(exportData.budgets, [
          'id',
          'userId',
          'amount',
          'currentSpent',
          'accountId',
          'categoryId',
          'payeeId',
          'lastResetDate',
          'createdAt',
          'updatedAt',
        ]);
        downloadCSV(budgetsCSV, 'my_money_budgets.csv');
      }

      // Export import match rules
      if (exportData.importMatchRules && exportData.importMatchRules.length > 0) {
        const importMatchRulesCSV = convertToCSV(exportData.importMatchRules, [
          'id',
          'pattern',
          'accountId',
          'categoryId',
          'payeeId',
          'userId',
          'createdAt',
          'updatedAt',
        ]);
        downloadCSV(importMatchRulesCSV, 'my_money_importMatchRules.csv');
      }

      showSuccessNotification('Data exported successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      console.error('Export failed:', error);
      showErrorNotification(`Export failed: ${errorMessage}`);
    } finally {
      setExporting(false);
    }
  };

  /**
   * Handle import button click
   * Triggers file input dialog
   */
  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  /**
   * Handle file selection for import
   * Parses filename to determine entity type and calls import mutation
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Determine entity type from filename
    // Remove my_money_ prefix if present for detection
    const filename = file.name.toLowerCase().replace(/^my_money_/, '');
    let entityType: string;
    if (filename.includes('account')) {
      entityType = 'accounts';
    } else if (filename.includes('categor')) {
      entityType = 'categories';
    } else if (filename.includes('payee')) {
      entityType = 'payees';
    } else if (filename.includes('recurring')) {
      entityType = 'recurringTransactions';
    } else if (filename.includes('transaction')) {
      entityType = 'transactions';
    } else if (filename.includes('setting') || filename.includes('preference')) {
      entityType = 'settings';
    } else if (filename.includes('budget')) {
      entityType = 'budgets';
    } else if (filename.includes('importmatch') || filename.includes('import_match')) {
      entityType = 'importMatchRules';
    } else {
      // Default to transactions if cannot determine
      entityType = 'transactions';
    }

    setImporting(true);
    try {
      const result = await importCSVMutation({
        variables: {
          file,
          entityType,
        },
      });

      if (result.data?.importCSV) {
        const { success, created, updated, errors } = result.data.importCSV;
        if (success) {
          showSuccessNotification(`Import successful! Created: ${created}, Updated: ${updated}`);
        } else {
          const errorMsg = errors.length > 0 ? ` Errors: ${errors.join(', ')}` : '';
          showErrorNotification(
            `Import completed with issues. Created: ${created}, Updated: ${updated}.${errorMsg}`
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      console.error('Import failed:', error);
      showErrorNotification(`Import failed: ${errorMessage}`);
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <PageContainer>
      {/* Management Section */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography
            variant="h6"
            component="h2"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <DataObject fontSize="small" />
            Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your accounts, categories, payees, and other data
          </Typography>
        </Box>
        <List disablePadding>
          {[
            {
              icon: <Workspaces sx={{ mr: 2, color: 'primary.main' }} />,
              primary: 'Manage Workspaces',
              secondary: 'Create and manage shared workspaces',
              onClick: () => {
                void navigate('/workspaces');
              },
            },
            {
              icon: <AccountBalance sx={{ mr: 2, color: 'primary.main' }} />,
              primary: 'Manage Accounts',
              secondary: 'View and edit your accounts',
              onClick: () => {
                void navigate('/accounts');
              },
            },
            {
              icon: <Category sx={{ mr: 2, color: 'primary.main' }} />,
              primary: 'Manage Categories',
              secondary: 'Organize your income and expense categories',
              onClick: () => {
                void navigate('/categories');
              },
            },
            {
              icon: <Person sx={{ mr: 2, color: 'primary.main' }} />,
              primary: 'Manage Payees',
              secondary: 'Manage people and organizations you transact with',
              onClick: () => {
                void navigate('/payees');
              },
            },
            {
              icon: <AttachMoney sx={{ mr: 2, color: 'primary.main' }} />,
              primary: 'Manage Budgets',
              secondary: 'Set and track spending limits',
              onClick: () => {
                void navigate('/budgets');
              },
            },
            {
              icon: <Schedule sx={{ mr: 2, color: 'primary.main' }} />,
              primary: 'Recurring Transactions',
              secondary: 'Manage scheduled and recurring transactions',
              onClick: () => {
                void navigate('/schedule');
              },
            },
          ].map((item, index) => (
            <React.Fragment key={item.primary}>
              {index > 0 && <Divider />}
              <ListItemButton
                onClick={item.onClick}
                sx={{
                  py: 1.5,
                  px: 3,
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                {item.icon}
                <ListItemText primary={item.primary} secondary={item.secondary} />
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Card>

      {/* Import/Export Section */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography
            variant="h6"
            component="h2"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Download fontSize="small" />
            Import & Export
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Backup your data or import from CSV files
          </Typography>
        </Box>
        <List disablePadding>
          <React.Fragment>
            <ListItemButton
              onClick={handleImportClick}
              disabled={importing}
              sx={{
                py: 1.5,
                px: 3,
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Upload sx={{ mr: 2, color: importing ? 'text.disabled' : 'primary.main' }} />
              <ListItemText
                primary={importing ? 'Importing...' : 'Import Data'}
                secondary={
                  importing
                    ? 'Please wait while we import your data'
                    : 'Import accounts, transactions, and more from CSV files'
                }
              />
              {importing ? <CircularProgress size={20} sx={{ ml: 'auto' }} /> : null}
            </ListItemButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                void handleFileChange(e);
              }}
            />
          </React.Fragment>
          <Divider />
          <ListItemButton
            onClick={() => {
              void handleExport();
            }}
            disabled={exporting}
            sx={{
              py: 1.5,
              px: 3,
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <Download sx={{ mr: 2, color: exporting ? 'text.disabled' : 'primary.main' }} />
            <ListItemText
              primary={exporting ? 'Exporting...' : 'Export Data'}
              secondary={
                exporting
                  ? 'Preparing your data for download'
                  : 'Download all your data as CSV files for backup'
              }
            />
            {exporting ? <CircularProgress size={20} sx={{ ml: 'auto' }} /> : null}
          </ListItemButton>
        </List>
      </Card>

      {/* Display Settings Navigation */}
      <Card sx={{ mb: 3 }}>
        <List disablePadding>
          <ListItemButton
            onClick={() => {
              void navigate('/settings/display');
            }}
            sx={{
              py: 1.5,
              px: 3,
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <Settings sx={{ mr: 2, color: 'primary.main' }} />
            <ListItemText
              primary="Display Settings"
              secondary="Customize currency, date format, color scheme, and calculator keypad layout"
            />
          </ListItemButton>
        </List>
      </Card>

      {/* Account Actions Section */}
      <Card>
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography
            variant="h6"
            component="h2"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Security fontSize="small" />
            Account Actions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your account and data
          </Typography>
        </Box>
        <List disablePadding>
          <ListItemButton
            onClick={handleAddExampleData}
            disabled={addingExampleData}
            sx={{
              py: 1.5,
              px: 3,
              color: 'primary.main',
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            {addingExampleData ? (
              <CircularProgress size={20} sx={{ mr: 2 }} />
            ) : (
              <DataObject sx={{ mr: 2 }} />
            )}
            <ListItemText
              primary={addingExampleData ? 'Adding Example Data...' : 'Add Example Data'}
              secondary="Add sample accounts, categories, and payees to get started"
            />
          </ListItemButton>
          <Divider />
          <ListItemButton
            onClick={handleResetDataClick}
            sx={{
              py: 1.5,
              px: 3,
              color: 'error.main',
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <RestartAlt sx={{ mr: 2 }} />
            <ListItemText
              primary="Reset All Data"
              secondary="Permanently delete all your data (default items will remain)"
            />
          </ListItemButton>
          <Divider />
          <ListItemButton
            onClick={handleLogout}
            sx={{
              py: 1.5,
              px: 3,
              color: 'error.main',
              transition: 'background-color 0.2s ease',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <Logout sx={{ mr: 2 }} />
            <ListItemText primary="Logout" secondary="Sign out of your account" />
          </ListItemButton>
        </List>
      </Card>

      {/* Reset Data Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={handleResetDialogClose}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestartAlt color="error" />
            <Typography variant="h6" component="span" color="error">
              Reset All Data
            </Typography>
          </Box>
        }
        actions={
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%' }}>
            <Button
              onClick={handleResetDialogClose}
              disabled={resetting}
              variant="outlined"
              size="large"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleResetData();
              }}
              disabled={
                resetting ||
                resetConfirmationText !== 'I understand this will delete all my data permanently'
              }
              variant="contained"
              color="error"
              size="large"
              startIcon={
                resetting ? <CircularProgress size={16} color="inherit" /> : <RestartAlt />
              }
            >
              {resetting ? 'Resetting...' : 'Reset All Data'}
            </Button>
          </Box>
        }
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            minWidth: { xs: 'auto', sm: 500 },
            maxWidth: 600,
          }}
        >
          <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              ⚠️ Warning: This action cannot be undone
            </Typography>
            <Typography variant="body2">
              This will permanently delete all your data including:
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 3 }}>
              <li>
                <Typography variant="body2">All accounts (except default)</Typography>
              </li>
              <li>
                <Typography variant="body2">All transactions</Typography>
              </li>
              <li>
                <Typography variant="body2">All categories (except default)</Typography>
              </li>
              <li>
                <Typography variant="body2">All payees (except default)</Typography>
              </li>
              <li>
                <Typography variant="body2">All budgets</Typography>
              </li>
              <li>
                <Typography variant="body2">All recurring transactions</Typography>
              </li>
            </Box>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'medium' }}>
              Only the default account, category, and payee will remain.
            </Typography>
          </Box>

          <Box>
            <Typography variant="body1" sx={{ mb: 1, fontWeight: 'medium' }}>
              To confirm this action, please type the following:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                mb: 2,
              }}
            >
              I understand this will delete all my data permanently
            </Typography>
            <TextField
              label="Type confirmation text"
              value={resetConfirmationText}
              onChange={(e) => {
                setResetConfirmationText(e.target.value);
              }}
              fullWidth
              placeholder="I understand this will delete all my data permanently"
              disabled={resetting}
              error={
                resetConfirmationText !== '' &&
                resetConfirmationText !== 'I understand this will delete all my data permanently'
              }
              helperText={
                resetConfirmationText !== '' &&
                resetConfirmationText !== 'I understand this will delete all my data permanently'
                  ? 'Text does not match'
                  : 'Type the exact text above to enable the reset button'
              }
              size="medium"
            />
          </Box>
        </Box>
      </Dialog>

      {/* Export Dialog with Workspace and Member Selection */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => {
          if (!exporting) {
            setExportDialogOpen(false);
          }
        }}
        title="Export Data"
        maxWidth="sm"
        fullWidth
        actions={
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', width: '100%' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setExportDialogOpen(false);
              }}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                void handleExport();
              }}
              disabled={exporting}
              startIcon={exporting ? <CircularProgress size={16} /> : <Download />}
            >
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </Box>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Select workspace and members to filter the exported data. Leave members unselected to
            export all data.
          </Typography>

          {workspaces.length > 0 ? (
            <WorkspaceSelector
              value={selectedWorkspaceId}
              onChange={(workspaceId: string) => {
                setSelectedWorkspaceId(workspaceId);
                setSelectedMemberIds([]);
              }}
            />
          ) : null}

          {selectedWorkspaceId && members.length > 0 ? (
            <MultiSelect
              label="Filter by Members (optional)"
              options={members.map((m) => ({
                id: m.userId,
                name: m.user.email,
              }))}
              value={selectedMemberIds}
              onChange={(value: string[]) => {
                setSelectedMemberIds(value);
              }}
            />
          ) : null}
        </Box>
      </Dialog>
    </PageContainer>
  );
}
