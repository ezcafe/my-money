/**
 * Import Page
 * PDF upload and bulk mapping UI
 */

import React, { useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Card } from '../components/ui/Card';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  UPLOAD_PDF,
  SAVE_IMPORTED_TRANSACTIONS,
  DELETE_UNMAPPED_IMPORTED_TRANSACTIONS,
} from '../graphql/mutations';
import { GET_RECENT_TRANSACTIONS, GET_TRANSACTIONS } from '../graphql/queries';
import { GET_WORKSPACES } from '../graphql/workspaceOperations';
import { MAX_RECENT_TRANSACTIONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { PageContainer } from '../components/common/PageContainer';
import { ImportUpload } from '../components/import/ImportUpload';
import { ImportMappingTable } from '../components/import/ImportMappingTable';
import { ImportActions } from '../components/import/ImportActions';
import { useImportMappings, type UnmappedTransaction } from '../hooks/useImportMappings';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { usePayees } from '../hooks/usePayees';

/**
 * Import Page Component
 */
export function ImportPage(): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unmappedTransactions, setUnmappedTransactions] = useState<UnmappedTransaction[]>([]);
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');

  // Use import mappings hook for state management
  const {
    descriptionMappings,
    cardNumber,
    cardAccountId,
    setDescriptionMapping,
    setCardAccountId,
    uniqueDescriptions,
    validateMappings,
  } = useImportMappings(unmappedTransactions);

  // Get data hooks
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { payees } = usePayees();

  // Get workspaces
  const { data: workspacesData } = useQuery<{
    workspaces: Array<{
      id: string;
      name: string;
    }>;
  }>(GET_WORKSPACES, {
    fetchPolicy: 'cache-and-network',
    skip: isAuthenticated !== true, // Skip query if not authenticated
  });

  const workspaces = workspacesData?.workspaces ?? [];

  // Upload PDF mutation
  const [uploadPDFMutation, { loading: uploading }] = useMutation<{
    uploadPDF: {
      success: boolean;
      importedCount: number;
      savedCount: number;
      unmappedTransactions: UnmappedTransaction[];
    };
  }>(UPLOAD_PDF, {
    refetchQueries: [
      { query: GET_TRANSACTIONS },
      {
        query: GET_RECENT_TRANSACTIONS,
        variables: {
          limit: MAX_RECENT_TRANSACTIONS,
          orderBy: { field: 'date', direction: 'desc' },
        },
      },
    ],
    awaitRefetchQueries: true,
    onCompleted: (data: {
      uploadPDF?: { savedCount: number; unmappedTransactions: UnmappedTransaction[] };
    }) => {
      if (data.uploadPDF) {
        const { savedCount, unmappedTransactions: unmapped } = data.uploadPDF;
        setUnmappedTransactions(unmapped ?? []);
        setSuccessMessage(
          `Upload successful! ${savedCount} transaction(s) were automatically saved. ${unmapped.length} transaction(s) need manual mapping.`
        );
        setFile(null);
      }
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    },
  });

  // Save transactions mutation
  const [saveTransactionsMutation, { loading: saving }] = useMutation<{
    saveImportedTransactions: {
      success: boolean;
      savedCount: number;
      errors: string[];
    };
  }>(SAVE_IMPORTED_TRANSACTIONS, {
    refetchQueries: [
      { query: GET_TRANSACTIONS },
      {
        query: GET_RECENT_TRANSACTIONS,
        variables: {
          limit: MAX_RECENT_TRANSACTIONS,
          orderBy: { field: 'date', direction: 'desc' },
        },
      },
    ],
    awaitRefetchQueries: true,
    onCompleted: (data: {
      saveImportedTransactions?: { savedCount: number; errors: string[] };
    }) => {
      if (data.saveImportedTransactions) {
        const { savedCount, errors } = data.saveImportedTransactions;
        if (errors.length > 0) {
          setError(`Some transactions failed to save: ${errors.join(', ')}`);
        } else {
          setSuccessMessage(`Successfully saved ${savedCount} transaction(s)!`);
          setUnmappedTransactions([]);
        }
      }
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
    },
  });

  // Delete unmapped transactions mutation
  const [deleteUnmappedMutation, { loading: deleting }] = useMutation<{
    deleteUnmappedImportedTransactions: boolean;
  }>(DELETE_UNMAPPED_IMPORTED_TRANSACTIONS, {
    onCompleted: () => {
      setSuccessMessage('Unmapped transactions ignored');
      setUnmappedTransactions([]);
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      setError(errorMessage);
    },
  });

  /**
   * Handle file select
   */
  const handleFileSelect = (selectedFile: File): void => {
    setError(null);
    setSuccessMessage(null);
    setFile(selectedFile);
  };

  /**
   * Handle file remove
   */
  const handleFileRemove = (): void => {
    setFile(null);
    setError(null);
    setSuccessMessage(null);
  };

  /**
   * Handle upload
   */
  const handleUpload = async (): Promise<void> => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      await uploadPDFMutation({
        variables: { file, dateFormat },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    }
  };

  /**
   * Handle save transactions
   */
  const handleSave = async (): Promise<void> => {
    // Validate mappings using hook
    const errors = validateMappings();
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
        variables: { mapping },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed';
      setError(errorMessage);
    }
  };

  /**
   * Handle ignore transactions
   */
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
    <PageContainer sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Upload Section */}
      <ImportUpload
        file={file}
        dateFormat={dateFormat}
        uploading={uploading}
        error={error}
        successMessage={successMessage}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        onDateFormatChange={setDateFormat}
        onUpload={handleUpload}
        onErrorDismiss={(): void => setError(null)}
        onSuccessDismiss={(): void => setSuccessMessage(null)}
      />

      {/* Mapping Section */}
      {unmappedTransactions.length > 0 && (
        <Card>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" component="h2">
                Map Transactions
              </Typography>
              <Chip
                label={`${unmappedTransactions.length} transaction${unmappedTransactions.length !== 1 ? 's' : ''}`}
                size="small"
                color="primary"
              />
              <Chip
                label={`${uniqueDescriptions.length} unique description${uniqueDescriptions.length !== 1 ? 's' : ''}`}
                size="small"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Some transactions need manual mapping. Please assign an account, category, and payee
              for each unique transaction description.
            </Typography>

            {/* Mapping Table */}
            <ImportMappingTable
              unmappedTransactions={unmappedTransactions}
              descriptionMappings={descriptionMappings}
              cardNumber={cardNumber}
              cardAccountId={cardAccountId}
              accounts={accounts}
              categories={categories}
              payees={payees}
              workspaces={workspaces}
              onMappingChange={setDescriptionMapping}
              onCardAccountChange={setCardAccountId}
              uniqueDescriptions={uniqueDescriptions}
            />

            {/* Action Buttons */}
            <ImportActions
              saving={saving}
              deleting={deleting}
              onSave={handleSave}
              onIgnore={handleIgnore}
            />
          </Box>
        </Card>
      )}
    </PageContainer>
  );
}
