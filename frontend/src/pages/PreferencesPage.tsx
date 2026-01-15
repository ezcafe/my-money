/**
 * Preferences Page
 * Allows user to change currency, toggle 000/decimal, manage categories, payees, schedule, and logout
 */

import React, {useState, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router';
import {Box, Typography, ToggleButtonGroup, ToggleButton, List, ListItem, ListItemButton, ListItemText, Divider, Autocomplete, TextField, Button, Tooltip, CircularProgress, Stack, Select, MenuItem, FormControl, InputLabel, Popover, IconButton} from '@mui/material';
import {useQuery, useMutation, useLazyQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {Dialog} from '../components/ui/Dialog';
import {ColorSchemePicker} from '../components/ui/ColorSchemePicker';
import {logout} from '../utils/oidc';
import {CURRENCIES, type Currency} from '../utils/currencies';
import {
  GET_PREFERENCES,
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
import {UPDATE_PREFERENCES, IMPORT_CSV, RESET_DATA} from '../graphql/mutations';
import {AccountBalance, Category, Person, Schedule, Upload, Download, Logout, RestartAlt, AttachMoney, HelpOutline, Settings, DataObject, Security} from '@mui/icons-material';
import {useNotifications} from '../contexts/NotificationContext';
import type {DateFormat} from '../contexts/DateFormatContext';
import {DEFAULT_DATE_FORMAT} from '../contexts/DateFormatContext';
import {pageContainerStyle} from '../constants/ui';

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
  preferences: {
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
 * Help Icon Component
 * Displays a help icon with tooltip on hover (desktop) and popover on click (mobile)
 * @param helpText - The help text to display
 */
function HelpIcon({helpText}: {helpText: string}): React.JSX.Element {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  /**
   * Handle help icon click
   * Opens popover on mobile devices
   */
  const handleClick = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handle popover close
   */
  const handleClose = (): void => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={helpText} arrow>
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            padding: 0.5,
            cursor: 'help',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          aria-label="Help"
        >
          <HelpOutline fontSize="small" color="action" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            maxWidth: 300,
            p: 1.5,
          },
        }}
      >
        <Typography variant="body2">{helpText}</Typography>
      </Popover>
    </>
  );
}

/**
 * Preferences Page Component
 */
export function PreferencesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const {showSuccessNotification, showErrorNotification} = useNotifications();
  const {data: preferencesData, loading: preferencesLoading} = useQuery<{
    preferences?: {currency: string; useThousandSeparator: boolean; dateFormat: string | null};
  }>(GET_PREFERENCES);
  const [updatePreferences, {loading: updating}] = useMutation<{
    updatePreferences: {id: string; currency: string; useThousandSeparator: boolean; colorScheme: string | null; colorSchemeValue: string | null; dateFormat: string | null};
  }>(UPDATE_PREFERENCES, {
    refetchQueries: ['GetPreferences'],
    awaitRefetchQueries: true,
    update: (cache, {data}) => {
      if (data?.updatePreferences) {
        // Explicitly write to cache - this ensures the cache is updated before refetchQueries runs
        cache.writeQuery({
          query: GET_PREFERENCES,
          data: {
            preferences: data.updatePreferences,
          },
        });
      }
    },
    onCompleted: () => {
      showSuccessNotification('Preferences updated successfully');
    },
    onError: (error) => {
      showErrorNotification(error.message || 'Failed to update preferences');
    },
  });

  const [useThousandSeparator, setUseThousandSeparator] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [dateFormat, setDateFormat] = useState<DateFormat>(DEFAULT_DATE_FORMAT);
  const currencyUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportDataQuery] = useLazyQuery<ExportDataQueryResult>(EXPORT_DATA);
  const [importCSVMutation] = useMutation<ImportCSVResult>(IMPORT_CSV, {
    refetchQueries: [
      {query: GET_ACCOUNTS},
      {query: GET_CATEGORIES},
      {query: GET_PAYEES},
      {query: GET_RECENT_TRANSACTIONS},
      {query: GET_RECURRING_TRANSACTIONS},
      {query: GET_BUDGETS},
      {query: GET_BUDGET_NOTIFICATIONS},
      {query: GET_PREFERENCES},
    ],
  });
  const [resetDataMutation, {loading: resetting}] = useMutation(RESET_DATA, {
    refetchQueries: [
      {query: GET_ACCOUNTS},
      {query: GET_CATEGORIES},
      {query: GET_PAYEES},
      {query: GET_RECENT_TRANSACTIONS},
      {query: GET_RECURRING_TRANSACTIONS},
      {query: GET_PREFERENCES},
      {query: GET_BUDGETS},
      {query: GET_BUDGET_NOTIFICATIONS},
      {query: GET_TRANSACTIONS},
      {query: GET_REPORT_TRANSACTIONS},
    ],
    awaitRefetchQueries: true,
    update: (cache) => {
      // Explicitly clear recentTransactions cache for all variable combinations
      // This ensures the home page shows empty data immediately
      try {
        // Evict all recentTransactions queries from cache
        cache.evict({fieldName: 'recentTransactions'});
        // Also evict transactions queries
        cache.evict({fieldName: 'transactions'});
        // Evict reportTransactions
        cache.evict({fieldName: 'reportTransactions'});
        // Garbage collect to remove orphaned references
        cache.gc();
      } catch (error) {
        // Silently handle cache eviction errors
        console.warn('Cache eviction failed during reset:', error);
      }
    },
  });

  // Initialize state from loaded preferences
  useEffect(() => {
    if (preferencesData?.preferences) {
      if (preferencesData.preferences.useThousandSeparator !== undefined) {
        setUseThousandSeparator(preferencesData.preferences.useThousandSeparator);
      }
      if (preferencesData.preferences.currency) {
        setCurrency(preferencesData.preferences.currency);
      }
      const format = preferencesData.preferences.dateFormat;
      if (format && (format === 'DD/MM/YYYY' || format === 'MM/DD/YYYY' || format === 'YYYY-MM-DD' || format === 'DD-MM-YYYY' || format === 'MM-DD-YYYY')) {
        setDateFormat(format as DateFormat);
      } else {
        setDateFormat(DEFAULT_DATE_FORMAT);
      }
    }
  }, [preferencesData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return (): void => {
      if (currencyUpdateTimeoutRef.current) {
        clearTimeout(currencyUpdateTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle logout
   * Clears tokens and redirects to login page
   */
  const handleLogout = (): void => {
    void logout();
    void navigate('/login', {replace: true});
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
   * Handle useThousandSeparator change
   * Saves preference to backend
   * @param newValue - The new value from ToggleButtonGroup ("000" or ".")
   */
  const handleUseThousandSeparatorChange = (newValue: string | null): void => {
    if (newValue === null) {
      return;
    }
    const checked = newValue === '000';
    setUseThousandSeparator(checked);
    void updatePreferences({
      variables: {
        input: {
          useThousandSeparator: checked,
        },
      },
    });
  };

  /**
   * Handle currency change
   * Updates local state immediately and debounces the API call to prevent excessive requests
   */
  const handleCurrencyChange = (newCurrency: string): void => {
    setCurrency(newCurrency);

    // Clear existing timeout if user is still typing
    if (currencyUpdateTimeoutRef.current) {
      clearTimeout(currencyUpdateTimeoutRef.current);
    }

    // Set new timeout to update preferences after user stops typing (500ms delay)
    currencyUpdateTimeoutRef.current = setTimeout(() => {
      void updatePreferences({
        variables: {
          input: {
            currency: newCurrency,
          },
        },
      });
      currencyUpdateTimeoutRef.current = null;
    }, 500);
  };

  /**
   * Handle date format change
   * Saves preference to backend
   * @param newFormat - The new date format
   */
  const handleDateFormatChange = (newFormat: DateFormat): void => {
    setDateFormat(newFormat);
    void updatePreferences({
      variables: {
        input: {
          dateFormat: newFormat,
        },
      },
    });
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
    const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});
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
      const {data} = await exportDataQuery();
      if (!data?.exportData) {
        return;
      }

      const exportData = data.exportData;

      // Export accounts
      if (exportData.accounts && exportData.accounts.length > 0) {
        const accountsCSV = convertToCSV(exportData.accounts, ['id', 'name', 'initBalance', 'isDefault']);
        downloadCSV(accountsCSV, 'my_money_accounts.csv');
      }

      // Export categories
      if (exportData.categories && exportData.categories.length > 0) {
        const categoriesCSV = convertToCSV(exportData.categories, ['id', 'name', 'type', 'isDefault']);
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

      // Export preferences
      if (exportData.preferences) {
        const preferencesCSV = convertToCSV([exportData.preferences], ['id', 'currency', 'useThousandSeparator', 'colorScheme', 'colorSchemeValue']);
        downloadCSV(preferencesCSV, 'my_money_preferences.csv');
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
    } else if (filename.includes('preference')) {
      entityType = 'preferences';
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
        const {success, created, updated, errors} = result.data.importCSV;
        if (success) {
          showSuccessNotification(`Import successful! Created: ${created}, Updated: ${updated}`);
        } else {
          const errorMsg = errors.length > 0 ? ` Errors: ${errors.join(', ')}` : '';
          showErrorNotification(`Import completed with issues. Created: ${created}, Updated: ${updated}.${errorMsg}`);
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
    <Box sx={pageContainerStyle}>
      {/* Management Section */}
      <Card sx={{mb: 3}}>
        <Box sx={{p: 3, pb: 2}}>
          <Typography variant="h6" component="h2" sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <DataObject fontSize="small" />
            Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
            Manage your accounts, categories, payees, and other data
          </Typography>
        </Box>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/accounts');
            }}>
              <AccountBalance sx={{mr: 2, color: 'primary.main'}} />
              <ListItemText
                primary="Manage Accounts"
                secondary="View and edit your accounts"
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/categories');
            }}>
              <Category sx={{mr: 2, color: 'primary.main'}} />
              <ListItemText
                primary="Manage Categories"
                secondary="Organize your income and expense categories"
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/payees');
            }}>
              <Person sx={{mr: 2, color: 'primary.main'}} />
              <ListItemText
                primary="Manage Payees"
                secondary="Manage people and organizations you transact with"
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/budgets');
            }}>
              <AttachMoney sx={{mr: 2, color: 'primary.main'}} />
              <ListItemText
                primary="Manage Budgets"
                secondary="Set and track spending limits"
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/schedule');
            }}>
              <Schedule sx={{mr: 2, color: 'primary.main'}} />
              <ListItemText
                primary="Recurring Transactions"
                secondary="Manage scheduled and recurring transactions"
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>

      {/* Import/Export Section */}
      <Card sx={{mb: 3}}>
        <Box sx={{p: 3, pb: 2}}>
          <Typography variant="h6" component="h2" sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Download fontSize="small" />
            Import & Export
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
            Backup your data or import from CSV files
          </Typography>
        </Box>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleImportClick}
              disabled={importing}
            >
              <Upload sx={{mr: 2, color: importing ? 'text.disabled' : 'primary.main'}} />
              <ListItemText
                primary={importing ? 'Importing...' : 'Import Data'}
                secondary={importing ? 'Please wait while we import your data' : 'Import accounts, transactions, and more from CSV files'}
              />
              {importing && <CircularProgress size={20} sx={{ml: 'auto'}} />}
            </ListItemButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{display: 'none'}}
              onChange={(e) => {
                void handleFileChange(e);
              }}
            />
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                void handleExport();
              }}
              disabled={exporting}
            >
              <Download sx={{mr: 2, color: exporting ? 'text.disabled' : 'primary.main'}} />
              <ListItemText
                primary={exporting ? 'Exporting...' : 'Export Data'}
                secondary={exporting ? 'Preparing your data for download' : 'Download all your data as CSV files for backup'}
              />
              {exporting && <CircularProgress size={20} sx={{ml: 'auto'}} />}
            </ListItemButton>
          </ListItem>
        </List>
      </Card>

      {/* Display Settings Section */}
      <Card sx={{mb: 3}}>
        <Box sx={{p: 3, pb: 2}}>
          <Typography variant="h6" component="h2" sx={{mb: 3, display: 'flex', alignItems: 'center', gap: 1}}>
          <Settings fontSize="small" />
          Display Settings
        </Typography>

        <Stack spacing={3}>
          {/* Number Format Setting */}
          <Box>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
              <Typography variant="subtitle2" component="label">
                Calculator Quick Button
              </Typography>
              <HelpIcon helpText="Choose which quick button appears on the calculator. The '000' button quickly adds '000' to your value (useful for entering thousands). The '.' button quickly adds a decimal point (useful for entering cents)." />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
              Choose which quick button appears on the calculator to help you enter values faster
            </Typography>
            <ToggleButtonGroup
              value={useThousandSeparator ? '000' : '.'}
              exclusive
              onChange={(_, newValue: string | null) => {
                handleUseThousandSeparatorChange(newValue);
              }}
              aria-label="calculator quick button"
              fullWidth
              disabled={preferencesLoading || updating}
              size="large"
            >
              <ToggleButton value="000" aria-label="000 button">
                <Box sx={{textAlign: 'center'}}>
                  <Typography variant="body2" sx={{fontWeight: 'bold'}}>000</Typography>
                  <Typography variant="caption" color="text.secondary">Quick button to add &apos;000&apos;</Typography>
                </Box>
              </ToggleButton>
              <ToggleButton value="." aria-label="decimal point button">
                <Box sx={{textAlign: 'center'}}>
                  <Typography variant="body2" sx={{fontWeight: 'bold'}}>.</Typography>
                  <Typography variant="caption" color="text.secondary">Quick button to add decimal point</Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
            {(preferencesLoading || updating) && (
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  {updating ? 'Saving...' : 'Loading...'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Currency Setting */}
          <Box>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
              <Typography variant="subtitle2" component="label">
                Currency
              </Typography>
              <HelpIcon helpText="Select your preferred currency. This will be used throughout the application for displaying amounts" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
              Select your preferred currency for displaying amounts
            </Typography>
            <Autocomplete
              options={CURRENCIES}
              getOptionLabel={(option) => `${option.code} - ${option.name}`}
              value={CURRENCIES.find((c) => c.code === currency) ?? null}
              onChange={(_event, newValue: Currency | null) => {
                if (newValue) {
                  handleCurrencyChange(newValue.code);
                }
              }}
              filterOptions={(options, {inputValue}) => {
                const searchValue = inputValue.toLowerCase();
                return options.filter(
                  (option) =>
                    option.code.toLowerCase().includes(searchValue) ||
                    option.name.toLowerCase().includes(searchValue),
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Currency"
                  placeholder="Search by code or name..."
                  fullWidth
                  helperText={updating ? 'Saving...' : undefined}
                />
              )}
              disabled={preferencesLoading || updating}
              fullWidth
            />
          </Box>

          {/* Date Format Setting */}
          <Box>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
              <Typography variant="subtitle2" component="label">
                Date Format
              </Typography>
              <HelpIcon helpText="Select your preferred date format. This will be used throughout the application for displaying dates" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
              Choose how dates are displayed throughout the application
            </Typography>
            <FormControl fullWidth disabled={preferencesLoading || updating}>
              <InputLabel>Date Format</InputLabel>
              <Select
                value={dateFormat}
                label="Date Format"
                onChange={(e) => {
                  handleDateFormatChange(e.target.value as DateFormat);
                }}
              >
                <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                <MenuItem value="DD-MM-YYYY">DD-MM-YYYY</MenuItem>
                <MenuItem value="MM-DD-YYYY">MM-DD-YYYY</MenuItem>
              </Select>
              {updating && (
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Saving...
                  </Typography>
                </Box>
              )}
            </FormControl>
          </Box>

          {/* Color Scheme Setting */}
          <Box>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
              <Typography variant="subtitle2" component="label">
                Color Scheme
              </Typography>
              <HelpIcon helpText="Customize the app's color theme. Choose from preset themes or create a custom color scheme" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{mb: 1.5}}>
              Customize the app&apos;s appearance with different color themes
            </Typography>
            <ColorSchemePicker />
          </Box>
        </Stack>
        </Box>
      </Card>

      {/* Account Actions Section */}
      <Card>
        <Box sx={{p: 3, pb: 2}}>
          <Typography variant="h6" component="h2" sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Security fontSize="small" />
            Account Actions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
            Manage your account and data
          </Typography>
        </Box>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleResetDataClick}
              sx={{color: 'error.main'}}
            >
              <RestartAlt sx={{mr: 2}} />
              <ListItemText
                primary="Reset All Data"
                secondary="Permanently delete all your data (default items will remain)"
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={{color: 'error.main'}}>
              <Logout sx={{mr: 2}} />
              <ListItemText
                primary="Logout"
                secondary="Sign out of your account"
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>

      {/* Reset Data Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={handleResetDialogClose}
        title={
          <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <RestartAlt color="error" />
            <Typography variant="h6" component="span" color="error">
              Reset All Data
            </Typography>
          </Box>
        }
        actions={
          <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end', width: '100%'}}>
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
              disabled={resetting || resetConfirmationText !== 'I understand this will delete all my data permanently'}
              variant="contained"
              color="error"
              size="large"
              startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <RestartAlt />}
            >
              {resetting ? 'Resetting...' : 'Reset All Data'}
            </Button>
          </Box>
        }
      >
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 3, minWidth: {xs: 'auto', sm: 500}, maxWidth: 600}}>
          <Box sx={{p: 2, bgcolor: 'error.light', borderRadius: 1}}>
            <Typography variant="body1" sx={{fontWeight: 'bold', mb: 1}}>
              ⚠️ Warning: This action cannot be undone
            </Typography>
            <Typography variant="body2">
              This will permanently delete all your data including:
            </Typography>
            <Box component="ul" sx={{mt: 1, mb: 0, pl: 3}}>
              <li><Typography variant="body2">All accounts (except default)</Typography></li>
              <li><Typography variant="body2">All transactions</Typography></li>
              <li><Typography variant="body2">All categories (except default)</Typography></li>
              <li><Typography variant="body2">All payees (except default)</Typography></li>
              <li><Typography variant="body2">All budgets</Typography></li>
              <li><Typography variant="body2">All recurring transactions</Typography></li>
            </Box>
            <Typography variant="body2" sx={{mt: 1, fontWeight: 'medium'}}>
              Only the default account, category, and payee will remain.
            </Typography>
          </Box>

          <Box>
            <Typography variant="body1" sx={{mb: 1, fontWeight: 'medium'}}>
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
                mb: 2
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
              error={resetConfirmationText !== '' && resetConfirmationText !== 'I understand this will delete all my data permanently'}
              helperText={
                resetConfirmationText !== '' && resetConfirmationText !== 'I understand this will delete all my data permanently'
                  ? 'Text does not match'
                  : 'Type the exact text above to enable the reset button'
              }
              size="medium"
            />
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}

