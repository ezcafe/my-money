/**
 * Version History Panel Component
 * Displays version history for an entity with timeline view and before/after diff
 */

import React, { useMemo } from 'react';
import { Box, Typography, Paper, Chip, Skeleton } from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from './ui/Timeline';
import { History, Info, Check, Edit } from '@mui/icons-material';
import { useQuery } from '@apollo/client/react';
import { GET_ENTITY_VERSIONS } from '../graphql/versionOperations';
import { GET_SETTINGS } from '../graphql/queries';
import {
  formatDateShort,
  formatCurrencyPreserveDecimals,
  formatRelativeTime,
  getTimeGroupLabel,
} from '../utils/formatting';
import { useDateFormat } from '../hooks/useDateFormat';
import { getAccountTypeLabel, getCategoryTypeLabel } from '../utils/groupSelectOptions';
import type { Account } from '../hooks/useAccounts';
import type { Category } from '../hooks/useCategories';
import type { DateFormat } from '../contexts/DateFormatContext';
import { ErrorAlert } from './common/ErrorAlert';
import { Card } from './ui/Card';

/**
 * Get a safe user-facing message from an unknown error
 */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Failed to load version history';
}

/** Display field for a version row; valueAfter is set when showing before → after diff */
export interface VersionDataDisplayField {
  label: string;
  value: string;
  valueAfter?: string;
}

/**
 * Format a raw value for display (handles Prisma Decimal and primitives)
 */
function toDecimalNumber(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (val !== null && typeof val === 'object' && 'toString' in val)
    return parseFloat(String((val as { toString: () => string }).toString())) || 0;
  return 0;
}

/**
 * Truncate UUID for readability
 */
function truncateId(id: string, maxLength = 8): string {
  if (id.length <= maxLength) return id;
  return `…${id.slice(-maxLength)}`;
}

/**
 * Convert unknown to string without using Object's default stringification
 */
function safeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && typeof (val as { toString?: () => string }).toString === 'function')
    return (val as { toString: () => string }).toString();
  return '[object]';
}

/**
 * Compare two values for equality (for diffing version data)
 */
function valueEqual(before: unknown, after: unknown): boolean {
  if (before === after) return true;
  if (before == null || after == null) return before == null && after == null;
  if (typeof before === 'number' || typeof after === 'number') {
    return toDecimalNumber(before) === toDecimalNumber(after);
  }
  if (typeof before === 'boolean' && typeof after === 'boolean') return before === after;
  const beforeStr = safeString(before);
  const afterStr = safeString(after);
  if (beforeStr === '' && afterStr === '') return true;
  return beforeStr === afterStr;
}

/**
 * Check if a field should be shown (only when changed, or when afterData is not provided)
 */
function shouldShowField(
  before: unknown,
  afterData: Record<string, unknown> | undefined,
  key: string
): boolean {
  if (afterData === undefined) return true;
  const afterVal = afterData[key];
  return !valueEqual(before, afterVal);
}

/**
 * Format after-value for display in add() (non-currency text/boolean/type fields)
 */
function formatAfterValue(
  key: string,
  label: string,
  rawAfter: unknown,
  options: { dateFormat: DateFormat }
): string {
  const { dateFormat } = options;
  if (rawAfter === undefined || rawAfter === null) return '';
  if (key === 'accountType')
    return getAccountTypeLabel(rawAfter as Account['accountType']);
  if (key === 'categoryType')
    return getCategoryTypeLabel(rawAfter as Category['categoryType']);
  if (typeof rawAfter === 'boolean') return rawAfter ? 'Yes' : 'No';
  const str = safeString(rawAfter);
  if (label.toLowerCase().includes('date') || key === 'date' || key === 'lastResetDate')
    return formatDateShort(str, dateFormat);
  if (key.endsWith('Id')) return truncateId(str);
  return str;
}

/**
 * Get display fields for a version's data; when afterData is provided returns before → after diff
 */
function getVersionDataDisplayFields(
  entityType: VersionHistoryPanelProps['entityType'],
  data: Record<string, unknown>,
  options: { currency: string; dateFormat: DateFormat },
  afterData?: Record<string, unknown>
): VersionDataDisplayField[] {
  const { currency, dateFormat } = options;
  const rows: VersionDataDisplayField[] = [];

  const add = (
    key: string,
    label: string,
    rawValue: unknown,
    displayValue?: string,
    rawAfter?: unknown
  ): void => {
    if (!shouldShowField(rawValue, afterData, key)) return;
    if (rawValue === undefined || rawValue === null) return;
    const display =
      displayValue ??
      (typeof rawValue === 'boolean'
        ? rawValue
          ? 'Yes'
          : 'No'
        : typeof rawValue === 'string'
          ? rawValue
          : safeString(rawValue));
    const valueAfter =
      afterData && rawAfter !== undefined && rawAfter !== null
        ? formatAfterValue(key, label, rawAfter, { dateFormat })
        : undefined;
    rows.push(valueAfter !== undefined ? { label, value: display, valueAfter } : { label, value: display });
  };

  const addCurrency = (key: string, label: string, val: unknown): void => {
    if (!shouldShowField(val, afterData, key)) return;
    if (val === undefined || val === null) return;
    const num = toDecimalNumber(val);
    const valueAfter =
      afterData?.[key] !== undefined
        ? formatCurrencyPreserveDecimals(toDecimalNumber(afterData[key]), currency)
        : undefined;
    rows.push(
      valueAfter !== undefined
        ? { label, value: formatCurrencyPreserveDecimals(num, currency), valueAfter }
        : { label, value: formatCurrencyPreserveDecimals(num, currency) }
    );
  };

  const addDate = (key: string, label: string, val: unknown): void => {
    if (!shouldShowField(val, afterData, key)) return;
    if (val === undefined || val === null) return;
    const valueAfter =
      afterData?.[key] !== undefined
        ? formatDateShort(safeString(afterData[key]), dateFormat)
        : undefined;
    rows.push(
      valueAfter !== undefined
        ? { label, value: formatDateShort(safeString(val), dateFormat), valueAfter }
        : { label, value: formatDateShort(safeString(val), dateFormat) }
    );
  };

  const addId = (key: string, label: string, val: unknown): void => {
    if (!shouldShowField(val, afterData, key)) return;
    if (val === undefined || val === null) return;
    const valueAfter =
      afterData?.[key] !== undefined
        ? truncateId(safeString(afterData[key]))
        : undefined;
    rows.push(
      valueAfter !== undefined
        ? { label, value: truncateId(safeString(val)), valueAfter }
        : { label, value: truncateId(safeString(val)) }
    );
  };

  switch (entityType) {
    case 'Account':
      add('name', 'Name', data.name, undefined, afterData?.name);
      if (data.accountType != null)
        add(
          'accountType',
          'Account type',
          data.accountType,
          getAccountTypeLabel(data.accountType as Account['accountType']),
          afterData?.accountType
        );
      addCurrency('initBalance', 'Initial balance', data.initBalance);
      addCurrency('balance', 'Balance', data.balance);
      add('isDefault', 'Default account', data.isDefault, undefined, afterData?.isDefault);
      break;
    case 'Category':
      add('name', 'Name', data.name, undefined, afterData?.name);
      if (data.categoryType != null)
        add(
          'categoryType',
          'Category type',
          data.categoryType,
          getCategoryTypeLabel(data.categoryType as Category['categoryType']),
          afterData?.categoryType
        );
      add('isDefault', 'Default category', data.isDefault, undefined, afterData?.isDefault);
      break;
    case 'Payee':
      add('name', 'Name', data.name, undefined, afterData?.name);
      add('isDefault', 'Default payee', data.isDefault, undefined, afterData?.isDefault);
      break;
    case 'Budget':
      addCurrency('amount', 'Amount', data.amount);
      addCurrency('currentSpent', 'Current spent', data.currentSpent);
      addId('accountId', 'Account', data.accountId);
      addId('categoryId', 'Category', data.categoryId);
      addId('payeeId', 'Payee', data.payeeId);
      addDate('lastResetDate', 'Last reset date', data.lastResetDate);
      break;
    case 'Transaction':
      addCurrency('value', 'Value', data.value);
      addDate('date', 'Date', data.date);
      addId('accountId', 'Account', data.accountId);
      addId('categoryId', 'Category', data.categoryId);
      addId('payeeId', 'Payee', data.payeeId);
      add('note', 'Note', data.note, undefined, afterData?.note);
      break;
    default:
      break;
  }

  return rows;
}

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
  /**
   * Current entity data (from parent). When provided, only changed fields are shown for the latest version.
   */
  currentData?: Record<string, unknown>;
}

/**
 * Version History Panel Component
 * Shows a timeline of all versions for an entity
 */
export function VersionHistoryPanel({
  entityType,
  entityId,
  limit = 50,
  currentData,
}: VersionHistoryPanelProps): React.JSX.Element | null {
  const { dateFormat } = useDateFormat();
  const { data: settingsData } = useQuery<{ settings?: { currency: string } }>(GET_SETTINGS);
  const currency = settingsData?.settings?.currency ?? 'USD';

  const { data, loading, error } = useQuery<{
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

  // Only show panel when at least one version has at least one changed value to display
  const hasAnyChangedValue = useMemo(() => {
    if (sortedVersions.length === 0) return false;
    for (let i = 0; i < sortedVersions.length; i += 1) {
      const version = sortedVersions[i];
      if (!version) continue;
      const afterData =
        i === 0 ? currentData : sortedVersions[i - 1]?.data;
      const fields = getVersionDataDisplayFields(
        entityType,
        version.data,
        { currency, dateFormat },
        afterData
      );
      if (fields.length > 0) return true;
    }
    return false;
  }, [
    sortedVersions,
    entityType,
    currency,
    dateFormat,
    currentData,
  ]);

  /** Group versions by time (Today, Yesterday, This week, etc.) */
  const versionsByGroup = useMemo(() => {
    const map = new Map<string, typeof sortedVersions>();
    for (const v of sortedVersions) {
      const group = getTimeGroupLabel(v.editedAt);
      const list = map.get(group);
      if (list) list.push(v);
      else map.set(group, [v]);
    }
    const order = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];
    return order
      .filter((g) => map.has(g))
      .map((g) => ({ label: g, versions: map.get(g) ?? [] }));
  }, [sortedVersions]);

  /** Flattened list for afterData lookup (newest first) */
  const flatVersions = useMemo(
    () => versionsByGroup.flatMap((g) => g.versions),
    [versionsByGroup]
  );

  const lastUpdated =
    sortedVersions[0]?.editedAt != null
      ? formatRelativeTime(sortedVersions[0].editedAt)
      : null;

  if (loading) {
    return (
      <Card sx={{ p: 3 }} component="section" aria-label="Version history">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Skeleton variant="circular" width={28} height={28} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={140} height={28} />
            <Skeleton variant="text" width={100} height={20} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="rounded" height={80} />
            </Box>
          </Box>
        ))}
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ p: 3 }} component="section" aria-label="Version history">
        <ErrorAlert
          title="Error Loading Version History"
          message={getErrorMessage(error)}
        />
      </Card>
    );
  }

  if (sortedVersions.length === 0 || !hasAnyChangedValue) {
    return (
      <Card sx={{ p: 3 }} component="section" aria-label="Version history">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <History color="action" sx={{ fontSize: 28 }} />
          <Typography variant="h6" component="h2">
            Version History
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 3,
            px: 2,
            borderRadius: 2,
            bgcolor: 'action.hover',
          }}
        >
          <Info color="action" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            No version history yet. Changes will appear here after you edit this item.
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card sx={{ p: 3 }} component="section" aria-label="Version history">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <History color="primary" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h6" component="h2">
            Version History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {lastUpdated != null
              ? `Last updated ${lastUpdated}`
              : `${sortedVersions.length} version${sortedVersions.length !== 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Chip
          label={`${sortedVersions.length} change${sortedVersions.length !== 1 ? 's' : ''}`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ ml: 'auto' }}
        />
      </Box>

      <Timeline
        sx={{
          '&::before': {
            backgroundColor: 'grey.300',
            width: '2px',
          },
        }}
      >
        {versionsByGroup.map(({ label: groupLabel, versions: groupVersions }, groupIndex) => (
          <Box key={groupLabel} sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1, pl: 5, fontSize: '0.7rem' }}
            >
              {groupLabel}
            </Typography>
            {groupVersions.map((version, index) => {
              const flatIndex =
                versionsByGroup
                  .slice(0, groupIndex)
                  .reduce((acc, g) => acc + g.versions.length, 0) + index;
              const isCurrent = flatIndex === 0;
              const afterData =
                flatIndex === 0 ? currentData : flatVersions[flatIndex - 1]?.data;
              const fields = getVersionDataDisplayFields(
                entityType,
                version.data,
                { currency, dateFormat },
                afterData
              );
              return (
                <TimelineItem key={version.id} sx={{ mb: 2 }}>
                  <TimelineSeparator>
                    <TimelineDot
                      color={isCurrent ? 'grey' : 'success'}
                      variant="filled"
                      sx={{
                        width: 32,
                        height: 32,
                        ...(isCurrent && {
                          bgcolor: 'grey.300',
                          color: 'grey.600',
                        }),
                      }}
                    >
                      {isCurrent ? (
                        <Edit sx={{ fontSize: 18 }} />
                      ) : (
                        <Check sx={{ fontSize: 18, color: 'white' }} />
                      )}
                    </TimelineDot>
                    {flatIndex < flatVersions.length - 1 ? <TimelineConnector /> : null}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.25 }}
                      >
                        {formatRelativeTime(version.editedAt)}
                      </Typography>
                      <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 0.5 }}>
                        Version {version.version}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ display: 'block', mb: fields.length > 0 ? 1 : 0 }}
                      >
                        {version.editor.email}
                      </Typography>
                      {fields.length > 0 ? (
                        <Box component="dl" sx={{ m: 0, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                          {fields.map(({ label, value, valueAfter }) => (
                            <Box
                              key={label}
                              sx={{
                                display: 'flex',
                                gap: 1,
                                alignItems: 'baseline',
                                flexWrap: 'wrap',
                                '&:not(:last-child)': { mb: 0.75 },
                              }}
                            >
                              <Typography
                                component="dt"
                                variant="caption"
                                color="text.secondary"
                                sx={{ minWidth: 0, flex: '0 0 auto' }}
                              >
                                {label}:
                              </Typography>
                              <Typography
                                component="dd"
                                variant="caption"
                                sx={{
                                  fontWeight: 500,
                                  m: 0,
                                  color: 'text.primary',
                                  ...(valueAfter != null && {
                                    '& .version-old': {
                                      textDecoration: 'line-through',
                                      opacity: 0.8,
                                      mr: 0.5,
                                    },
                                    '& .version-new': {
                                      color: 'success.main',
                                      fontWeight: 600,
                                    },
                                  }),
                                }}
                              >
                                {valueAfter != null ? (
                                  <>
                                    <span className="version-old">{value}</span>
                                    <span className="version-arrow"> → </span>
                                    <span className="version-new">{valueAfter}</span>
                                  </>
                                ) : (
                                  value
                                )}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : null}
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Box>
        ))}
      </Timeline>
    </Card>
  );
}
