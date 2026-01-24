/**
 * Conflict Resolution Dialog Component
 * Dialog for resolving entity conflicts with side-by-side comparison
 */

import React, { useState, useMemo } from 'react';
import { Box, Typography, Divider, Chip, Alert } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Warning, CheckCircle, Cancel } from '@mui/icons-material';
import { useMutation } from '@apollo/client/react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import {
  RESOLVE_CONFLICT,
  DISMISS_CONFLICT,
  GET_ENTITY_CONFLICTS,
} from '../graphql/conflictOperations';
import { formatDateTime, dateFormatToDateTimeFormat } from '../utils/formatting';
import { useDateFormat } from '../hooks/useDateFormat';

export interface ConflictResolutionDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when dialog is closed
   */
  onClose: () => void;
  /**
   * Conflict data
   */
  conflict: {
    id: string;
    entityType: string;
    entityId: string;
    currentVersion: number;
    incomingVersion: number;
    currentData: Record<string, unknown>;
    incomingData: Record<string, unknown>;
    detectedAt: string;
    workspaceId: string;
  };
  /**
   * Workspace ID for refetching conflicts
   */
  workspaceId: string;
}

/**
 * Conflict Resolution Dialog Component
 * Shows side-by-side comparison of conflicting versions
 */
export function ConflictResolutionDialog({
  open,
  onClose,
  conflict,
  workspaceId,
}: ConflictResolutionDialogProps): React.JSX.Element {
  const { dateFormat } = useDateFormat();
  const [chosenVersion, setChosenVersion] = useState<'current' | 'incoming' | null>(null);
  const [resolving, setResolving] = useState(false);

  const [resolveConflict, { loading: resolvingConflict }] = useMutation(RESOLVE_CONFLICT, {
    refetchQueries: [
      {
        query: GET_ENTITY_CONFLICTS,
        variables: { workspaceId },
      },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      setResolving(false);
      onClose();
    },
    onError: () => {
      setResolving(false);
    },
  });

  const [dismissConflict, { loading: dismissingConflict }] = useMutation(DISMISS_CONFLICT, {
    refetchQueries: [
      {
        query: GET_ENTITY_CONFLICTS,
        variables: { workspaceId },
      },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      onClose();
    },
  });

  /**
   * Get field differences between current and incoming data
   */
  const fieldDifferences = useMemo(() => {
    const differences: Array<{
      field: string;
      currentValue: unknown;
      incomingValue: unknown;
    }> = [];

    const allKeys = new Set([
      ...Object.keys(conflict.currentData),
      ...Object.keys(conflict.incomingData),
    ]);

    for (const key of allKeys) {
      // Skip metadata fields
      if (
        [
          'id',
          'version',
          'createdAt',
          'updatedAt',
          'createdBy',
          'lastEditedBy',
          'workspaceId',
        ].includes(key)
      ) {
        continue;
      }

      const currentValue = conflict.currentData[key];
      const incomingValue = conflict.incomingData[key];

      // Check if values are different
      if (JSON.stringify(currentValue) !== JSON.stringify(incomingValue)) {
        differences.push({
          field: key,
          currentValue,
          incomingValue,
        });
      }
    }

    return differences;
  }, [conflict.currentData, conflict.incomingData]);

  /**
   * Handle resolve conflict
   */
  const handleResolve = async (): Promise<void> => {
    if (!chosenVersion) {
      return;
    }

    setResolving(true);

    const versionToUse =
      chosenVersion === 'current' ? conflict.currentVersion : conflict.incomingVersion;

    try {
      await resolveConflict({
        variables: {
          conflictId: conflict.id,
          chosenVersion: versionToUse,
        },
      });
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      setResolving(false);
    }
  };

  /**
   * Handle dismiss conflict (use current version)
   */
  const handleDismiss = async (): Promise<void> => {
    try {
      await dismissConflict({
        variables: {
          conflictId: conflict.id,
        },
      });
    } catch (err) {
      console.error('Failed to dismiss conflict:', err);
    }
  };

  /**
   * Format value for display
   */
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    // At this point, value is a primitive (string, number, symbol, bigint)
    // TypeScript knows value is not null, undefined, boolean, or object
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }
    // Handle symbol (rare case) - symbols have a toString method
    if (typeof value === 'symbol') {
      return value.toString();
    }
    // Fallback (should never reach here, but TypeScript requires exhaustive handling)
    // At this point, value must be a primitive that we've already handled
    // Use type assertion to satisfy linter
    return String(value as string | number | bigint);
  };

  const loading = resolvingConflict || dismissingConflict || resolving;

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6">Resolve Conflict</Typography>
        </Box>
      }
      maxWidth="md"
      fullWidth
      actions={
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', width: '100%' }}>
          <Button
            variant="outlined"
            onClick={handleDismiss}
            disabled={loading}
            startIcon={<Cancel />}
          >
            Dismiss (Use Current)
          </Button>
          <Button
            variant="contained"
            onClick={handleResolve}
            disabled={loading || !chosenVersion}
            startIcon={<CheckCircle />}
          >
            Resolve
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Alert severity="warning">
          A conflict was detected for {conflict.entityType} {conflict.entityId}. Another user has
          made changes while you were editing. Please choose which version to keep.
        </Alert>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Detected: {formatDateTime(conflict.detectedAt, dateFormatToDateTimeFormat(dateFormat))}
          </Typography>
        </Box>

        {fieldDifferences.length > 0 ? (
          <>
            <Divider />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    p: 2,
                    border: `2px solid ${chosenVersion === 'current' ? 'primary.main' : 'divider'}`,
                    borderRadius: 1,
                    backgroundColor:
                      chosenVersion === 'current' ? 'action.selected' : 'background.paper',
                    cursor: 'pointer',
                  }}
                  onClick={() => setChosenVersion('current')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      Current Version
                    </Typography>
                    <Chip label={`v${conflict.currentVersion}`} size="small" color="primary" />
                    {chosenVersion === 'current' ? <CheckCircle color="primary" /> : null}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {fieldDifferences.map((diff) => (
                      <Box key={diff.field}>
                        <Typography variant="caption" color="text.secondary">
                          {diff.field}:
                        </Typography>
                        <Typography variant="body2">{formatValue(diff.currentValue)}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    p: 2,
                    border: `2px solid ${chosenVersion === 'incoming' ? 'primary.main' : 'divider'}`,
                    borderRadius: 1,
                    backgroundColor:
                      chosenVersion === 'incoming' ? 'action.selected' : 'background.paper',
                    cursor: 'pointer',
                  }}
                  onClick={() => setChosenVersion('incoming')}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      Incoming Version
                    </Typography>
                    <Chip label={`v${conflict.incomingVersion}`} size="small" />
                    {chosenVersion === 'incoming' ? <CheckCircle color="primary" /> : null}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {fieldDifferences.map((diff) => (
                      <Box key={diff.field}>
                        <Typography variant="caption" color="text.secondary">
                          {diff.field}:
                        </Typography>
                        <Typography variant="body2">{formatValue(diff.incomingValue)}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </>
        ) : (
          <Alert severity="info">No field differences detected between versions.</Alert>
        )}
      </Box>
    </Dialog>
  );
}
