/**
 * Import Mapping Table Component
 * Handles card number mapping and description mappings table for import transactions
 */

import React, { memo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme,
  Chip,
  Divider,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { TextField } from '../ui/TextField';
import {
  getAccountTypeLabel,
  getCategoryTypeLabel,
  GROUP_HEADER_STYLES,
} from '../../utils/groupSelectOptions';
import type { Account } from '../../hooks/useAccounts';
import type { Category } from '../../hooks/useCategories';
import type { UnmappedTransaction, DescriptionMapping } from '../../hooks/useImportMappings';

/**
 * Workspace type
 */
interface Workspace {
  id: string;
  name: string;
}

/**
 * ImportMappingTable component props
 */
interface ImportMappingTableProps {
  unmappedTransactions: UnmappedTransaction[];
  descriptionMappings: Map<string, DescriptionMapping>;
  cardNumber: string | null;
  cardAccountId: string;
  accounts: Account[];
  categories: Category[];
  payees: Array<{ id: string; name: string }>;
  workspaces: Workspace[];
  onMappingChange: (description: string, field: keyof DescriptionMapping, value: string) => void;
  onCardAccountChange: (accountId: string) => void;
  uniqueDescriptions: string[];
}

/**
 * Import Mapping Table Component
 */
const ImportMappingTableComponent = ({
  unmappedTransactions,
  descriptionMappings,
  cardNumber,
  cardAccountId,
  accounts,
  categories,
  payees,
  workspaces,
  onMappingChange,
  onCardAccountChange,
  uniqueDescriptions,
}: ImportMappingTableProps): React.JSX.Element => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Find selected account object for Autocomplete
  const selectedCardAccount = accounts.find((acc) => acc.id === cardAccountId) ?? null;

  return (
    <>
      {/* Workspace Detection Summary */}
      {unmappedTransactions.some((txn) => txn.detectedWorkspaceId) ? (
        <Box sx={{ mb: 3, p: 2, backgroundColor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Workspace Detection
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Workspaces have been automatically detected for some transactions. You can override them
            below if needed.
          </Typography>
        </Box>
      ) : null}

      {/* Card number mapping */}
      {cardNumber ? (
        <Box sx={{ mb: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Card Number Mapping
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Card Number: <strong>{cardNumber}</strong>
          </Typography>
          <Autocomplete<Account, false, false, false>
            options={accounts}
            getOptionLabel={(option) => option.name}
            groupBy={(option) => getAccountTypeLabel(option.accountType)}
            value={selectedCardAccount}
            onChange={(_, value): void => {
              onCardAccountChange(value?.id ?? '');
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            componentsProps={{
              popper: {
                sx: GROUP_HEADER_STYLES,
              },
            }}
            renderInput={(params) => <TextField {...params} label="Select Account" />}
          />
        </Box>
      ) : null}

      {cardNumber ? <Divider sx={{ my: 3 }} /> : null}

      {/* Description mappings table */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Transaction Descriptions
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Map each unique description to an account (required), category, and payee
        </Typography>
      </Box>
      {isMobile ? (
        // Mobile view: vertical stacking
        <Box sx={{ mb: 3, backgroundColor: 'action.hover', borderRadius: 1, p: 1 }}>
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
                  mb: 2,
                }}
              >
                <Box sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                    {desc}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Chip
                      label={`${count} transaction${count !== 1 ? 's' : ''}`}
                      size="small"
                      variant="outlined"
                    />
                    {(() => {
                      const firstTxn = unmappedTransactions.find(
                        (txn) => txn.rawDescription === desc
                      );
                      const detectedWorkspaceId = firstTxn?.detectedWorkspaceId;
                      const detectedWorkspace = detectedWorkspaceId
                        ? workspaces.find((w) => w.id === detectedWorkspaceId)
                        : null;
                      return detectedWorkspace ? (
                        <Chip
                          label={`Detected: ${detectedWorkspace.name}`}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      ) : null;
                    })()}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Payee</InputLabel>
                    <Select
                      value={mapping.payeeId}
                      label="Payee"
                      onChange={(e): void => {
                        onMappingChange(desc, 'payeeId', e.target.value);
                      }}
                      renderValue={(value) => {
                        const selectedPayee = payees.find((p) => p.id === value);
                        const displayText = selectedPayee?.name ?? '';
                        return (
                          <Tooltip title={displayText} placement="top">
                            <Box
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                              }}
                            >
                              {displayText}
                            </Box>
                          </Tooltip>
                        );
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            maxHeight: 300,
                            '& .MuiMenuItem-root': {
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            },
                          },
                        },
                      }}
                    >
                      {payees.map((payee) => (
                        <MenuItem key={payee.id} value={payee.id}>
                          {payee.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Autocomplete<Category, false, false, false>
                    options={categories}
                    getOptionLabel={(option) => option.name}
                    groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
                    value={categories.find((cat) => cat.id === mapping.categoryId) ?? null}
                    onChange={(_, value): void => {
                      onMappingChange(desc, 'categoryId', value?.id ?? '');
                    }}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    componentsProps={{
                      popper: {
                        sx: GROUP_HEADER_STYLES,
                      },
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Category"
                        sx={{
                          '& .MuiInputBase-input': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        }}
                        inputProps={{
                          ...params.inputProps,
                          title:
                            categories.find((cat) => cat.id === mapping.categoryId)?.name ?? '',
                        }}
                      />
                    )}
                  />
                  <Autocomplete<Account, false, false, false>
                    options={accounts}
                    getOptionLabel={(option) => option.name}
                    groupBy={(option) => getAccountTypeLabel(option.accountType)}
                    value={accounts.find((acc) => acc.id === mapping.accountId) ?? null}
                    onChange={(_, value): void => {
                      onMappingChange(desc, 'accountId', value?.id ?? '');
                    }}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    componentsProps={{
                      popper: {
                        sx: GROUP_HEADER_STYLES,
                      },
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account *"
                        required
                        sx={{
                          '& .MuiInputBase-input': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        }}
                        inputProps={{
                          ...params.inputProps,
                          title: accounts.find((acc) => acc.id === mapping.accountId)?.name ?? '',
                        }}
                      />
                    )}
                  />
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
                <TableCell>Payee</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Account</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uniqueDescriptions.map((desc) => {
                const mapping = descriptionMappings.get(desc);
                if (!mapping) return null;

                // Count transactions with this description
                const count = unmappedTransactions.filter(
                  (txn) => txn.rawDescription === desc
                ).length;

                return (
                  <TableRow key={desc}>
                    <TableCell>
                      <Typography variant="body2">{desc}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          ({count} transaction{count !== 1 ? 's' : ''})
                        </Typography>
                        {(() => {
                          const firstTxn = unmappedTransactions.find(
                            (txn) => txn.rawDescription === desc
                          );
                          const detectedWorkspaceId = firstTxn?.detectedWorkspaceId;
                          const detectedWorkspace = detectedWorkspaceId
                            ? workspaces.find((w) => w.id === detectedWorkspaceId)
                            : null;
                          return detectedWorkspace ? (
                            <Chip
                              label={`Detected: ${detectedWorkspace.name}`}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          ) : null;
                        })()}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Payee</InputLabel>
                        <Select
                          value={mapping.payeeId}
                          label="Payee"
                          onChange={(e): void => {
                            onMappingChange(desc, 'payeeId', e.target.value);
                          }}
                          renderValue={(value) => {
                            const selectedPayee = payees.find((p) => p.id === value);
                            const displayText = selectedPayee?.name ?? '';
                            return (
                              <Tooltip title={displayText} placement="top">
                                <Box
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '100%',
                                  }}
                                >
                                  {displayText}
                                </Box>
                              </Tooltip>
                            );
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                maxHeight: 300,
                                '& .MuiMenuItem-root': {
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                },
                              },
                            },
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
                    <TableCell sx={{ minWidth: 300 }}>
                      <Autocomplete<Category, false, false, false>
                        size="small"
                        options={categories}
                        getOptionLabel={(option) => option.name}
                        groupBy={(option) => getCategoryTypeLabel(option.categoryType)}
                        value={categories.find((cat) => cat.id === mapping.categoryId) ?? null}
                        onChange={(_, value): void => {
                          onMappingChange(desc, 'categoryId', value?.id ?? '');
                        }}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        componentsProps={{
                          popper: {
                            sx: GROUP_HEADER_STYLES,
                          },
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Category"
                            size="small"
                            sx={{
                              '& .MuiInputBase-input': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                            }}
                            inputProps={{
                              ...params.inputProps,
                              title:
                                categories.find((cat) => cat.id === mapping.categoryId)?.name ?? '',
                            }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <Autocomplete<Account, false, false, false>
                        size="small"
                        options={accounts}
                        getOptionLabel={(option) => option.name}
                        groupBy={(option) => getAccountTypeLabel(option.accountType)}
                        value={accounts.find((acc) => acc.id === mapping.accountId) ?? null}
                        onChange={(_, value): void => {
                          onMappingChange(desc, 'accountId', value?.id ?? '');
                        }}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        componentsProps={{
                          popper: {
                            sx: GROUP_HEADER_STYLES,
                          },
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Account"
                            required
                            size="small"
                            sx={{
                              '& .MuiInputBase-input': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                            }}
                            inputProps={{
                              ...params.inputProps,
                              title:
                                accounts.find((acc) => acc.id === mapping.accountId)?.name ?? '',
                            }}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </>
  );
};

ImportMappingTableComponent.displayName = 'ImportMappingTable';

export const ImportMappingTable = memo(ImportMappingTableComponent);
