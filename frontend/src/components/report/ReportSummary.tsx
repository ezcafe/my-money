/**
 * Report Summary Component
 * Displays summary statistics cards
 */

import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { AttachMoney, TrendingUp, TrendingDown } from '@mui/icons-material';
import { Card } from '../ui/Card';

/**
 * Summary statistics interface
 */
export interface SummaryStats {
  transactionCount: number;
  totalAmount: number;
  income: number;
  expense: number;
}

/**
 * ReportSummary component props
 */
interface ReportSummaryProps {
  summaryStats: SummaryStats;
  totalCount: number;
  currency: string;
  hasFilters: boolean;
  formatCurrencyAbbreviated: (value: number, currencyCode: string) => string;
}

/**
 * Report Summary Component
 */
const ReportSummaryComponent = ({
  summaryStats,
  totalCount,
  currency,
  hasFilters,
  formatCurrencyAbbreviated,
}: ReportSummaryProps): React.JSX.Element | null => {
  // Don't render if no filters applied or no transactions
  if (!hasFilters || totalCount === 0) {
    return null;
  }

  return (
    <>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 4 }}>
          <Card sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AttachMoney color="primary" />
              <Typography variant="subtitle2" color="text.secondary">
                Total
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {formatCurrencyAbbreviated(summaryStats.totalAmount, currency)}
            </Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUp sx={{ color: 'success.main' }} />
              <Typography variant="subtitle2" color="text.secondary">
                Income
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'success.main' }}>
              {formatCurrencyAbbreviated(summaryStats.income, currency)}
            </Typography>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingDown sx={{ color: 'error.main' }} />
              <Typography variant="subtitle2" color="text.secondary">
                Expenses
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'error.main' }}>
              {formatCurrencyAbbreviated(summaryStats.expense, currency)}
            </Typography>
          </Card>
        </Grid>
      </Grid>
    </>
  );
};

ReportSummaryComponent.displayName = 'ReportSummary';

export const ReportSummary = memo(ReportSummaryComponent);
