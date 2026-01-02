/**
 * Import Page
 * PDF upload and bulk mapping UI
 */

import React, {useState, useMemo} from 'react';
import {
  Box,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {validateFileType, validateFileSize} from '../utils/validation';
import {ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES} from '../utils/constants';
import {useMutation} from '@apollo/client/react';
import {UPLOAD_PDF, SAVE_IMPORTED_TRANSACTIONS, DELETE_UNMAPPED_IMPORTED_TRANSACTIONS} from '../graphql/mutations';
import {useAccounts} from '../hooks/useAccounts';
import {useCategories} from '../hooks/useCategories';
import {usePayees} from '../hooks/usePayees';

/**
 * Unmapped transaction type
 */
interface UnmappedTransaction {
  id: string;
  rawDate: string;
  rawDescription: string;
  rawDebit: number | null;
  rawCredit: number | null;
  suggestedAccountId: string | null;
  suggestedCategoryId: string | null;
  suggestedPayeeId: string | null;
  cardNumber: string | null;
}

/**
 * Description mapping state
 */
interface DescriptionMapping {
  description: string;
  accountId: string;
  categoryId: string;
  payeeId: string;
}

/**
 * Import Page Component
 */
export function ImportPage(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unmappedTransactions, setUnmappedTransactions] = useState<UnmappedTransaction[]>([]);
  const [cardNumber, setCardNumber] = useState<string | null>(null);
  const [cardAccountId, setCardAccountId] = useState<string>('');
  const [descriptionMappings, setDescriptionMappings] = useState<Map<string, DescriptionMapping>>(new Map());
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // 600px breakpoint

  const {accounts} = useAccounts();
  const {categories} = useCategories();
  const {payees} = usePayees();

  // Group transactions by unique description
  const uniqueDescriptions = useMemo(() => {
    const descriptions = new Set<string>();
    for (const txn of unmappedTransactions) {
      descriptions.add(txn.rawDescription);
    }
    return Array.from(descriptions);
  }, [unmappedTransactions]);

  // Initialize mappings when unmapped transactions are loaded
  React.useEffect(() => {
    if (unmappedTransactions.length > 0) {
      // Set card number from first transaction
      const firstCardNumber = unmappedTransactions[0]?.cardNumber;
      if (firstCardNumber) {
        setCardNumber(firstCardNumber);
      }

      // Initialize description mappings
      const newMappings = new Map<string, DescriptionMapping>();
      for (const desc of uniqueDescriptions) {
        // Find first transaction with this description for suggested values
        const firstTxn = unmappedTransactions.find((txn) => txn.rawDescription === desc);
        if (firstTxn && !newMappings.has(desc)) {
          newMappings.set(desc, {
            description: desc,
            accountId: firstTxn.suggestedAccountId ?? accounts[0]?.id ?? '',
            categoryId: firstTxn.suggestedCategoryId ?? categories[0]?.id ?? '',
            payeeId: firstTxn.suggestedPayeeId ?? payees[0]?.id ?? '',
          });
        }
      }
      setDescriptionMappings(newMappings);

      // Set card account from first transaction's suggested account
      if (unmappedTransactions[0]?.suggestedAccountId) {
        setCardAccountId(unmappedTransactions[0].suggestedAccountId);
      } else if (accounts[0]?.id) {
        setCardAccountId(accounts[0].id);
      }
    }
  }, [unmappedTransactions, uniqueDescriptions, accounts, categories, payees]);

  const [uploadPDFMutation, {loading: uploading}] = useMutation<{
    uploadPDF: {
      success: boolean;
      importedCount: number;
      savedCount: number;
      unmappedTransactions: UnmappedTransaction[];
    };
  }>(UPLOAD_PDF, {
    onCompleted: (data: {uploadPDF?: {savedCount: number; unmappedTransactions: UnmappedTransaction[]}}) => {
      if (data.uploadPDF) {
        const {savedCount, unmappedTransactions: unmapped} = data.uploadPDF;
        setUnmappedTransactions(unmapped ?? []);
        setSuccessMessage(
          `Upload successful! ${savedCount} transaction(s) were automatically saved. ${unmapped.length} transaction(s) need manual mapping.`,
        );
        setFile(null);
      }
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    },
  });

  const [saveTransactionsMutation, {loading: saving}] = useMutation<{
    saveImportedTransactions: {
      success: boolean;
      savedCount: number;
      errors: string[];
    };
  }>(SAVE_IMPORTED_TRANSACTIONS, {
    refetchQueries: ['GetTransactions', 'GetRecentTransactions', 'GetAccount'],
    awaitRefetchQueries: true,
    onCompleted: (data: {saveImportedTransactions?: {savedCount: number; errors: string[]}}) => {
      if (data.saveImportedTransactions) {
        const {savedCount, errors} = data.saveImportedTransactions;
        if (errors.length > 0) {
          setError(`Some transactions failed to save: ${errors.join(', ')}`);
        } else {
          setSuccessMessage(`Successfully saved ${savedCount} transaction(s)!`);
          setUnmappedTransactions([]);
          setDescriptionMappings(new Map());
          setCardNumber(null);
          setCardAccountId('');
        }
      }
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
    },
  });

  const [deleteUnmappedMutation, {loading: deleting}] = useMutation<{
    deleteUnmappedImportedTransactions: boolean;
  }>(DELETE_UNMAPPED_IMPORTED_TRANSACTIONS, {
    onCompleted: () => {
      setSuccessMessage('Unmapped transactions ignored');
      setUnmappedTransactions([]);
      setDescriptionMappings(new Map());
      setCardNumber(null);
      setCardAccountId('');
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMessage);
    },
  });

  const handleFileChange = (e: {target: {files?: FileList | null} | null}): void => {
    setError(null);
    setSuccessMessage(null);
    if (e.target?.files?.[0]) {
      const selectedFile = e.target.files[0];

      if (!validateFileType(selectedFile, ALLOWED_FILE_TYPES)) {
        setError('Please select a PDF file');
        return;
      }

      if (!validateFileSize(selectedFile, MAX_FILE_SIZE_BYTES)) {
        setError(`File size must be less than ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await uploadPDFMutation({
        variables: {file, dateFormat},
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    }
  };

  const handleDescriptionMappingChange = (description: string, field: keyof DescriptionMapping, value: string): void => {
    const mapping = descriptionMappings.get(description);
    if (!mapping) return;

    const updated = {...mapping, [field]: value};
    setDescriptionMappings(new Map(descriptionMappings.set(description, updated)));
  };

  const handleSave = async (): Promise<void> => {
    // Validate card number mapping if card number exists
    if (cardNumber && !cardAccountId) {
      setError('Please select an account for the card number');
      return;
    }

    // Validate all description mappings
    const errors: string[] = [];
    for (const [desc, mapping] of descriptionMappings.entries()) {
      if (!mapping.accountId) {
        errors.push(`Account is required for description: ${desc}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
      return;
    }

    setError(null);

    // Prepare bulk mapping
    const mapping = {
      cardNumber: cardNumber ?? null,
      cardAccountId: cardNumber ? cardAccountId : null,
      descriptionMappings: Array.from(descriptionMappings.values()).map((m) => ({
        description: m.description,
        accountId: m.accountId,
        categoryId: m.categoryId || null,
        payeeId: m.payeeId || null,
      })),
    };

    try {
      await saveTransactionsMutation({
        variables: {mapping},
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
    }
  };

  const handleIgnore = async (): Promise<void> => {
    setError(null);
    try {
      await deleteUnmappedMutation();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ignore failed';
      setError(errorMessage);
    }
  };

  return (
    <Box sx={{p: 2}}>
      <Typography variant="h4" component="h1" gutterBottom>
        Import Transactions
      </Typography>

      <Card sx={{p: 2, mb: 2}}>
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Credit Card Statement
        </Typography>
        {error && (
          <Alert severity="error" sx={{mb: 2}} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{mb: 2}} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}
        <Box sx={{mb: 2}}>
          <FormControl fullWidth sx={{mb: 2}}>
            <InputLabel>Date Format</InputLabel>
            <Select
              value={dateFormat}
              label="Date Format"
              onChange={(e): void => {
                setDateFormat(e.target.value);
              }}
            >
              <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
              <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
              <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
              <MenuItem value="DD-MM-YYYY">DD-MM-YYYY</MenuItem>
              <MenuItem value="MM-DD-YYYY">MM-DD-YYYY</MenuItem>
            </Select>
          </FormControl>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            style={{display: 'none'}}
            id="pdf-upload-input"
          />
          <label htmlFor="pdf-upload-input">
            <Button variant="outlined" component="span" sx={{mr: 2}}>
              Select PDF File
            </Button>
          </label>
          {file && <Typography variant="body2" sx={{mt: 1}}>Selected: {file.name}</Typography>}
        </Box>
        <Button
          variant="contained"
          onClick={(): void => {
            void handleUpload();
          }}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload and Parse'}
        </Button>
      </Card>

      {unmappedTransactions.length > 0 && (
        <Card sx={{p: 2, mt: 2}}>
          <Typography variant="h6" component="h2" gutterBottom>
            Manual Mapping ({unmappedTransactions.length} transaction(s), {uniqueDescriptions.length} unique description(s))
          </Typography>

          {/* Card number mapping */}
          {cardNumber && (
            <Box sx={{mb: 3, mt: 2}}>
              <FormControl fullWidth>
                <InputLabel>Map Card Number to Account</InputLabel>
                <Select
                  value={cardAccountId}
                  label="Map Card Number to Account"
                  onChange={(e): void => {
                    setCardAccountId(e.target.value);
                  }}
                >
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" sx={{mt: 1, color: 'text.secondary'}}>
                  Card Number: {cardNumber}
                </Typography>
              </FormControl>
            </Box>
          )}

          {/* Description mappings table */}
          <TableContainer component={Paper} sx={{mt: 2}}>
            {isMobile ? (
              // Mobile view: vertical stacking
              <Box>
                {uniqueDescriptions.map((desc) => {
                  const mapping = descriptionMappings.get(desc);
                  if (!mapping) return null;

                  // Count transactions with this description
                  const count = unmappedTransactions.filter((txn) => txn.rawDescription === desc).length;

                  return (
                    <Box
                      key={desc}
                      sx={{
                        p: 2,
                        mb: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{mb: 2, fontWeight: 'medium'}}>
                        {desc}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{mb: 2, display: 'block'}}>
                        ({count} transaction{count !== 1 ? 's' : ''})
                      </Typography>
                      <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                        <FormControl fullWidth required>
                          <InputLabel>Account</InputLabel>
                          <Select
                            value={mapping.accountId}
                            label="Account"
                            onChange={(e): void => {
                              handleDescriptionMappingChange(desc, 'accountId', e.target.value);
                            }}
                          >
                            {accounts.map((account) => (
                              <MenuItem key={account.id} value={account.id}>
                                {account.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl fullWidth>
                          <InputLabel>Category</InputLabel>
                          <Select
                            value={mapping.categoryId}
                            label="Category"
                            onChange={(e): void => {
                              handleDescriptionMappingChange(desc, 'categoryId', e.target.value);
                            }}
                          >
                            {categories.map((category) => (
                              <MenuItem key={category.id} value={category.id}>
                                {category.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl fullWidth>
                          <InputLabel>Payee</InputLabel>
                          <Select
                            value={mapping.payeeId}
                            label="Payee"
                            onChange={(e): void => {
                              handleDescriptionMappingChange(desc, 'payeeId', e.target.value);
                            }}
                          >
                            {payees.map((payee) => (
                              <MenuItem key={payee.id} value={payee.id}>
                                {payee.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              // Desktop view: horizontal table
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Transaction Description</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Payee</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {uniqueDescriptions.map((desc) => {
                    const mapping = descriptionMappings.get(desc);
                    if (!mapping) return null;

                    // Count transactions with this description
                    const count = unmappedTransactions.filter((txn) => txn.rawDescription === desc).length;

                    return (
                      <TableRow key={desc}>
                        <TableCell>
                          <Typography variant="body2">{desc}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({count} transaction{count !== 1 ? 's' : ''})
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth required>
                            <InputLabel>Account</InputLabel>
                            <Select
                              value={mapping.accountId}
                              label="Account"
                              onChange={(e): void => {
                                handleDescriptionMappingChange(desc, 'accountId', e.target.value);
                              }}
                            >
                              {accounts.map((account) => (
                                <MenuItem key={account.id} value={account.id}>
                                  {account.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select
                              value={mapping.categoryId}
                              label="Category"
                              onChange={(e): void => {
                                handleDescriptionMappingChange(desc, 'categoryId', e.target.value);
                              }}
                            >
                              <MenuItem value="">None</MenuItem>
                              {categories.map((category) => (
                                <MenuItem key={category.id} value={category.id}>
                                  {category.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <InputLabel>Payee</InputLabel>
                            <Select
                              value={mapping.payeeId}
                              label="Payee"
                              onChange={(e): void => {
                                handleDescriptionMappingChange(desc, 'payeeId', e.target.value);
                              }}
                            >
                              <MenuItem value="">None</MenuItem>
                              {payees.map((payee) => (
                                <MenuItem key={payee.id} value={payee.id}>
                                  {payee.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          <Box sx={{mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2}}>
            <Button variant="outlined" onClick={(): void => void handleIgnore()} disabled={deleting}>
              {deleting ? 'Ignoring...' : 'Ignore'}
            </Button>
            <Button variant="contained" onClick={(): void => void handleSave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Transactions'}
            </Button>
          </Box>
        </Card>
      )}
    </Box>
  );
}
