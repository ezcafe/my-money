/**
 * Preferences Page
 * Allows user to change currency, toggle 000/decimal, manage categories, payees, schedule, and logout
 */

import React, {useState, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router';
import {Box, Typography, ToggleButtonGroup, ToggleButton, List, ListItem, ListItemButton, ListItemText, Divider, Autocomplete, TextField, Button} from '@mui/material';
import {useQuery, useMutation, useLazyQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {Dialog} from '../components/ui/Dialog';
import {ColorSchemePicker} from '../components/ui/ColorSchemePicker';
import {logout} from '../utils/oidc';
import {CURRENCIES, type Currency} from '../utils/currencies';
import {GET_PREFERENCES, EXPORT_DATA} from '../graphql/queries';
import {UPDATE_PREFERENCES, IMPORT_CSV, RESET_DATA} from '../graphql/mutations';
import {AccountBalance, Category, Person, Schedule, Upload, Download, Logout, RestartAlt} from '@mui/icons-material';

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
  } | null;
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
 * Preferences Page Component
 */
export function PreferencesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const {data: preferencesData, loading: preferencesLoading} = useQuery<{
    preferences?: {currency: string; useThousandSeparator: boolean};
  }>(GET_PREFERENCES);
  const [updatePreferences, {loading: updating}] = useMutation(UPDATE_PREFERENCES, {
    refetchQueries: ['GetPreferences'],
    awaitRefetchQueries: true,
  });

  const [useThousandSeparator, setUseThousandSeparator] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const currencyUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportDataQuery] = useLazyQuery<ExportDataQueryResult>(EXPORT_DATA);
  const [importCSVMutation] = useMutation<ImportCSVResult>(IMPORT_CSV, {
    refetchQueries: ['GetAccounts', 'GetCategories', 'GetPayees', 'GetRecentTransactions', 'GetRecurringTransactions'],
  });
  const [resetDataMutation, {loading: resetting}] = useMutation(RESET_DATA, {
    refetchQueries: ['GetAccounts', 'GetCategories', 'GetPayees', 'GetRecentTransactions', 'GetRecurringTransactions', 'GetPreferences'],
  });

  // Initialize state from loaded preferences
  useEffect(() => {
    if (preferencesData?.preferences) {
      setUseThousandSeparator(preferencesData.preferences.useThousandSeparator);
      setCurrency(preferencesData.preferences.currency);
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
    logout();
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
      // eslint-disable-next-line no-alert
      alert('Data reset successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Reset failed';
      console.error('Reset failed:', error);
      // eslint-disable-next-line no-alert
      alert(`Reset failed: ${errorMessage}`);
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
        downloadCSV(accountsCSV, 'accounts.csv');
      }

      // Export categories
      if (exportData.categories && exportData.categories.length > 0) {
        const categoriesCSV = convertToCSV(exportData.categories, ['id', 'name', 'isDefault']);
        downloadCSV(categoriesCSV, 'categories.csv');
      }

      // Export payees
      if (exportData.payees && exportData.payees.length > 0) {
        const payeesCSV = convertToCSV(exportData.payees, ['id', 'name', 'isDefault']);
        downloadCSV(payeesCSV, 'payees.csv');
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
        downloadCSV(transactionsCSV, 'transactions.csv');
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
        downloadCSV(recurringCSV, 'recurringTransactions.csv');
      }

      // Export preferences
      if (exportData.preferences) {
        const preferencesCSV = convertToCSV([exportData.preferences], ['id', 'currency', 'useThousandSeparator']);
        downloadCSV(preferencesCSV, 'preferences.csv');
      }
    } catch (error) {
      console.error('Export failed:', error);
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
    const filename = file.name.toLowerCase();
    let entityType: string;
    if (filename.includes('account')) {
      entityType = 'accounts';
    } else if (filename.includes('categor')) {
      entityType = 'categories';
    } else if (filename.includes('payee')) {
      entityType = 'payees';
    } else if (filename.includes('transaction') && !filename.includes('recurring')) {
      entityType = 'transactions';
    } else if (filename.includes('recurring')) {
      entityType = 'recurringTransactions';
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
          // eslint-disable-next-line no-alert
          alert(`Import successful! Created: ${created}, Updated: ${updated}`);
        } else {
          // eslint-disable-next-line no-alert
          alert(`Import completed with errors. Created: ${created}, Updated: ${updated}. Errors: ${errors.join(', ')}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      console.error('Import failed:', error);
      // eslint-disable-next-line no-alert
      alert(`Import failed: ${errorMessage}`);
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Box>
      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" component="h2" gutterBottom>
          Display Settings
        </Typography>
        <Box sx={{mb: 2}}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Show on Calculator
          </Typography>
          <ToggleButtonGroup
            value={useThousandSeparator ? '000' : '.'}
            exclusive
            onChange={(_, newValue: string | null) => {
              handleUseThousandSeparatorChange(newValue);
            }}
            aria-label="show on calculator"
            fullWidth
            disabled={preferencesLoading || updating}
          >
            <ToggleButton value="000" aria-label="thousand separator">
              000
            </ToggleButton>
            <ToggleButton value="." aria-label="decimal separator">
              .
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{mt: 2}}>
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
                label="Currency"
                fullWidth
              />
            )}
            disabled={preferencesLoading || updating}
            fullWidth
          />
        </Box>
        <Box sx={{mt: 3}}>
          <ColorSchemePicker />
        </Box>
      </Card>

      <Card>
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/accounts');
            }}>
              <ListItemText primary="Manage Accounts" />
              <AccountBalance />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/categories');
            }}>
              <ListItemText primary="Manage Categories" />
              <Category />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/payees');
            }}>
              <ListItemText primary="Manage Payees" />
              <Person />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={() => {
              void navigate('/schedule');
            }}>
              <ListItemText primary="Schedule" />
              <Schedule />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={handleImportClick} disabled={importing}>
              <ListItemText primary={importing ? 'Importing...' : 'Import'} />
              <Upload />
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
            <ListItemButton onClick={() => {
              void handleExport();
            }} disabled={exporting}>
              <ListItemText primary={exporting ? 'Exporting...' : 'Export'} />
              <Download />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={handleResetDataClick} sx={{color: 'error.main'}}>
              <ListItemText primary="Reset data" />
              <RestartAlt />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} sx={{color: 'error.main'}}>
              <ListItemText primary="Logout" />
              <Logout />
            </ListItemButton>
          </ListItem>
        </List>
      </Card>

      {/* Reset Data Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={handleResetDialogClose}
        title="Reset Data"
        actions={
          <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
            <Button onClick={handleResetDialogClose} disabled={resetting} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleResetData();
              }}
              disabled={resetting || resetConfirmationText !== 'I understand this will delete all my data permanently'}
              variant="contained"
              color="error"
            >
              {resetting ? 'Resetting...' : 'Reset now'}
            </Button>
          </Box>
        }
      >
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400}}>
          <Typography variant="body1">
            This will permanently delete all your data except the default account, category, and payee.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            To confirm, please type: <strong>I understand this will delete all my data permanently</strong>
          </Typography>
          <TextField
            label="Confirmation"
            value={resetConfirmationText}
            onChange={(e) => {
              setResetConfirmationText(e.target.value);
            }}
            fullWidth
            placeholder="I understand this will delete all my data permanently"
            disabled={resetting}
          />
        </Box>
      </Dialog>
    </Box>
  );
}


