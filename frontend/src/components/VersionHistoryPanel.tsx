/**
 * Version History Panel Component
 * Displays version history for an entity with timeline view
 */

import React, {useMemo} from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from './ui/Timeline';
import {History, Person} from '@mui/icons-material';
import {useQuery} from '@apollo/client/react';
import {GET_ENTITY_VERSIONS} from '../graphql/versionOperations';
import {formatDateShort} from '../utils/formatting';
import {useDateFormat} from '../hooks/useDateFormat';
import {LoadingSpinner} from './common/LoadingSpinner';
import {ErrorAlert} from './common/ErrorAlert';
import {EmptyState} from './common/EmptyState';
import {Card} from './ui/Card';

export interface VersionHistoryPanelProps {
  /**
   * Entity type (Account, Category, Payee, Transaction, Budget)
   */
  entityType: 'Account' | 'Category' | 'Payee' | 'Transaction' | 'Budget';
  /**
   * Entity ID
   */
  entityId: string;
  /**
   * Maximum number of versions to display
   */
  limit?: number;
}

/**
 * Version History Panel Component
 * Shows a timeline of all versions for an entity
 */
export function VersionHistoryPanel({
  entityType,
  entityId,
  limit = 50,
}: VersionHistoryPanelProps): React.JSX.Element {
  const {dateFormat} = useDateFormat();
  const {data, loading, error} = useQuery<{
    entityVersions: Array<{
      id: string;
      version: number;
      data: Record<string, unknown>;
      editedBy: string;
      editedAt: string;
      editor: {
        id: string;
        email: string;
      };
    }>;
  }>(GET_ENTITY_VERSIONS, {
    variables: {
      entityType,
      entityId,
      limit,
    },
    fetchPolicy: 'cache-and-network',
  });

  const versions = useMemo(() => data?.entityVersions ?? [], [data?.entityVersions]);

  // Sort versions by version number (descending, newest first)
  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version - a.version);
  }, [versions]);

  if (loading) {
    return (
      <Card sx={{p: 3}}>
        <LoadingSpinner message="Loading version history..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{p: 3}}>
        <ErrorAlert
          title="Error Loading Version History"
          message={error?.message ?? 'Failed to load version history'}
        />
      </Card>
    );
  }

  if (sortedVersions.length === 0) {
    return (
      <Card sx={{p: 3}}>
        <EmptyState
          icon={<History />}
          title="No Version History"
          description="This entity has no version history yet."
        />
      </Card>
    );
  }

  /**
   * Get a summary of changes between two versions
   */
  const getChangeSummary = (versionData: Record<string, unknown>): string => {
    const keys = Object.keys(versionData).filter(
      (key) => !['id', 'version', 'createdAt', 'updatedAt', 'createdBy', 'lastEditedBy', 'workspaceId'].includes(key),
    );
    if (keys.length === 0) {
      return 'No changes';
    }
    return `${keys.length} field${keys.length !== 1 ? 's' : ''} changed`;
  };

  return (
    <Card sx={{p: 3}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 3}}>
        <History color="primary" />
        <Typography variant="h6" component="h2">
          Version History
        </Typography>
        <Chip label={`${sortedVersions.length} version${sortedVersions.length !== 1 ? 's' : ''}`} size="small" />
      </Box>

      <Timeline>
        {sortedVersions.map((version, index) => (
          <TimelineItem key={version.id}>
            <TimelineSeparator>
              <TimelineDot color={index === 0 ? 'primary' : 'grey'} variant="outlined">
                <Person fontSize="small" />
              </TimelineDot>
              {index < sortedVersions.length - 1 ? <TimelineConnector /> : null}
            </TimelineSeparator>
            <TimelineContent>
              <Paper sx={{p: 2, backgroundColor: index === 0 ? 'action.hover' : 'background.paper'}}>
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
                  <Typography variant="subtitle2" fontWeight="medium">
                    Version {version.version}
                    {index === 0 ? (
                      <Chip label="Current" size="small" color="primary" sx={{ml: 1}} />
                    ) : null}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateShort(version.editedAt, dateFormat)}
                  </Typography>
                </Box>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                  <Person fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {version.editor.email}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {getChangeSummary(version.data)}
                </Typography>
              </Paper>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Card>
  );
}
