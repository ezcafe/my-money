/**
 * Import Page
 * PDF upload and bulk mapping UI
 */

import React, {useState, useMemo, useCallback} from 'react';
import {
  Box,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
  LinearProgress,
  Chip,
  Divider,
} from '@mui/material';
import {Upload as UploadIcon, Description as DescriptionIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon} from '@mui/icons-material';
import {Card} from '../components/ui/Card';
import {Button} from '../components/ui/Button';
import {validateFileType, validateFileSize} from '../utils/validation';
import {ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES} from '../constants';
import {useMutation} from '@apollo/client/react';
import {UPLOAD_PDF, SAVE_IMPORTED_TRANSACTIONS, DELETE_UNMAPPED_IMPORTED_TRANSACTIONS} from '../graphql/mutations';
import {GET_RECENT_TRANSACTIONS, GET_TRANSACTIONS} from '../graphql/queries';
import {useAccounts} from '../hooks/useAccounts';
import {useCategories} from '../hooks/useCategories';
import {usePayees} from '../hooks/usePayees';
import {MAX_RECENT_TRANSACTIONS} from '../constants';
import {pageContainerStyle} from '../constants/ui';

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
  const [isDragging, setIsDragging] = useState(false);

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
          // Determine default categories
          const defaultIncomeCategory = categories.find(
            (category) => category.isDefault && category.type === 'INCOME',
          );

          const defaultExpenseCategory = categories.find(
            (category) => category.isDefault && category.type === 'EXPENSE',
          );

          // Determine initial category based on transaction type
          const isCredit = firstTxn.rawCredit !== null && firstTxn.rawCredit !== 0;

          let initialCategoryId = firstTxn.suggestedCategoryId ?? '';

          if (!initialCategoryId) {
            if (isCredit && defaultIncomeCategory) {
              // For credit transactions, prefer Default Income Category
              initialCategoryId = defaultIncomeCategory.id;
            } else if (!isCredit && defaultExpenseCategory) {
              // For non-credit transactions, prefer Default Expense Category when available
              initialCategoryId = defaultExpenseCategory.id;
            } else if (categories[0]?.id) {
              // Fallback to the first available category
              initialCategoryId = categories[0].id;
            }
          }

          newMappings.set(desc, {
            description: desc,
            accountId: firstTxn.suggestedAccountId ?? accounts[0]?.id ?? '',
            categoryId: initialCategoryId,
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
    refetchQueries: [
      {query: GET_TRANSACTIONS},
      {
        query: GET_RECENT_TRANSACTIONS,
        variables: {
          limit: MAX_RECENT_TRANSACTIONS,
          orderBy: {field: 'date', direction: 'desc'},
        },
      },
      // Note: GET_ACCOUNT requires an id variable, so we don't refetch it here
      // Individual account queries will be refetched when their pages are visited
    ],
    awaitRefetchQueries: true,
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
    refetchQueries: [
      {query: GET_TRANSACTIONS},
      {
        query: GET_RECENT_TRANSACTIONS,
        variables: {
          limit: MAX_RECENT_TRANSACTIONS,
          orderBy: {field: 'date', direction: 'desc'},
        },
      },
      // Note: GET_ACCOUNT requires an id variable, so we don't refetch it here
      // Individual account queries will be refetched when their pages are visited
    ],
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

  /**
   * Process and validate a file
   */
  const processFile = useCallback((selectedFile: File): void => {
    setError(null);
    setSuccessMessage(null);

    if (!validateFileType(selectedFile, [...ALLOWED_FILE_TYPES])) {
      setError('Please select a PDF file');
      return;
    }

    if (!validateFileSize(selectedFile, MAX_FILE_SIZE_BYTES)) {
      setError(`File size must be less than ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      return;
    }

    setFile(selectedFile);
  }, []);

  /**
   * Handle file input change
   */
  const handleFileChange = (e: {target: {files?: FileList | null} | null}): void => {
    if (e.target?.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [processFile]);

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

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 3, ...pageContainerStyle}}>
      {/* Upload Section */}
      <Card>
        <Box sx={{p: 3}}>
          <Typography variant="h6" component="h2" gutterBottom>
            Upload Credit Card Statement
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
            Upload a PDF statement from your credit card provider. The system will automatically extract and categorize transactions.
          </Typography>

          {error ? (
            <Alert severity="error" sx={{mb: 3}} onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert severity="success" sx={{mb: 3}} onClose={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          ) : null}

          {/* Date Format Selection */}
          <Box sx={{mb: 3}}>
            <FormControl fullWidth>
              <InputLabel>Date Format in PDF</InputLabel>
              <Select
                value={dateFormat}
                label="Date Format in PDF"
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
              <Typography variant="caption" color="text.secondary" sx={{mt: 1, display: 'block'}}>
                Select the date format used in your PDF statement
              </Typography>
            </FormControl>
          </Box>

          {/* File Upload Area */}
          <Box
            onDragOver={!isMobile ? handleDragOver : undefined}
            onDragLeave={!isMobile ? handleDragLeave : undefined}
            onDrop={!isMobile ? handleDrop : undefined}
            sx={{
              border: `2px dashed ${isDragging && !isMobile ? theme.palette.primary.main : theme.palette.divider}`,
              borderRadius: 0,
              p: 4,
              textAlign: 'center',
              backgroundColor: isDragging && !isMobile ? theme.palette.action.hover : 'transparent',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer',
              mb: 3,
            }}
            onClick={(): void => {
              document.getElementById('pdf-upload-input')?.click();
            }}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{display: 'none'}}
              id="pdf-upload-input"
            />
            {file ? (
              <Box>
                <CheckCircleIcon color="success" sx={{fontSize: 48, mb: 1}} />
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    px: 1,
                  }}
                  title={file.name}
                >
                  {file.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                  {formatFileSize(file.size)}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={(e): void => {
                    e.stopPropagation();
                    setFile(null);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                >
                  Remove File
                </Button>
              </Box>
            ) : (
              <Box>
                <UploadIcon sx={{fontSize: 48, color: 'text.secondary', mb: 2}} />
                <Typography variant="h6" gutterBottom>
                  {!isMobile && isDragging
                    ? 'Drop PDF file here'
                    : !isMobile
                      ? 'Drag and drop PDF file here'
                      : 'Select PDF File'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                  {!isMobile ? 'or click to browse' : 'Tap to browse files'}
                </Typography>
                <Button variant="outlined" startIcon={<UploadIcon />} component="span">
                  Select PDF File
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{mt: 2, display: 'block'}}>
                  Maximum file size: {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB
                </Typography>
              </Box>
            )}
          </Box>

          {/* Upload Button */}
          {file ? (
            <Box>
              {uploading ? <LinearProgress sx={{mb: 2}} /> : null}
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={(): void => {
                  void handleUpload();
                }}
                disabled={!file || uploading}
                startIcon={uploading ? undefined : <DescriptionIcon />}
              >
                {uploading ? 'Uploading and Parsing...' : 'Upload and Parse Statement'}
              </Button>
            </Box>
          ) : null}
        </Box>
      </Card>

      {/* Mapping Section */}
      {unmappedTransactions.length > 0 && (
        <Card>
          <Box sx={{p: 3}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap'}}>
              <Typography variant="h6" component="h2">
                Map Transactions
              </Typography>
              <Chip label={`${unmappedTransactions.length} transaction${unmappedTransactions.length !== 1 ? 's' : ''}`} size="small" color="primary" />
              <Chip label={`${uniqueDescriptions.length} unique description${uniqueDescriptions.length !== 1 ? 's' : ''}`} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
              Some transactions need manual mapping. Please assign an account, category, and payee for each unique transaction description.
            </Typography>

            {/* Card number mapping */}
            {cardNumber ? (
              <Box sx={{mb: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1}}>
                <Typography variant="subtitle2" gutterBottom>
                  Card Number Mapping
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{mb: 2, display: 'block'}}>
                  Card Number: <strong>{cardNumber}</strong>
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Select Account</InputLabel>
                  <Select
                    value={cardAccountId}
                    label="Select Account"
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
                </FormControl>
              </Box>
            ) : null}

            {cardNumber ? <Divider sx={{my: 3}} /> : null}

            {/* Description mappings table */}
            <Box sx={{mb: 2}}>
              <Typography variant="subtitle1" gutterBottom>
                Transaction Descriptions
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Map each unique description to an account (required), category, and payee
              </Typography>
            </Box>
            {isMobile ? (
              // Mobile view: vertical stacking
              <Box sx={{mb: 3, backgroundColor: 'action.hover', borderRadius: 1, p: 1}}>
                {uniqueDescriptions.map((desc) => {
                  const mapping = descriptionMappings.get(desc);
                  if (!mapping) return null;

                  // Count transactions with this description
                  const count = unmappedTransactions.filter((txn) => txn.rawDescription === desc).length;

                  return (
                    <Box
                      key={desc}
                      sx={{
                        p: 2.5,
                        mb: 2
                      }}
                    >
                      <Box sx={{mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider'}}>
                        <Typography variant="body1" sx={{fontWeight: 'medium', mb: 0.5}}>
                          {desc}
                        </Typography>
                        <Chip label={`${count} transaction${count !== 1 ? 's' : ''}`} size="small" variant="outlined" />
                      </Box>
                      <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                        <FormControl fullWidth required>
                          <InputLabel>Account *</InputLabel>
                          <Select
                            value={mapping.accountId}
                            label="Account *"
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
              <Box
                sx={{
                  mb: 3,
                  backgroundColor: 'action.hover',
                  borderRadius: 1,
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'auto',
                }}
              >
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
              </Box>
            )}

            <Divider sx={{my: 3}} />

            {/* Action Buttons */}
            <Box sx={{display: 'flex', flexDirection: {xs: 'column', sm: 'row'}, gap: 2, justifyContent: 'flex-end'}}>
              <Button
                variant="outlined"
                onClick={(): void => void handleIgnore()}
                disabled={deleting || saving}
                fullWidth={isMobile}
              >
                {deleting ? 'Ignoring...' : 'Ignore All'}
              </Button>
              <Button
                variant="contained"
                onClick={(): void => void handleSave()}
                disabled={saving || deleting}
                fullWidth={isMobile}
                size="large"
              >
                {saving ? 'Saving Transactions...' : 'Save All Transactions'}
              </Button>
            </Box>
            {saving ? <LinearProgress sx={{mt: 2}} /> : null}
          </Box>
        </Card>
      )}
    </Box>
  );
}
