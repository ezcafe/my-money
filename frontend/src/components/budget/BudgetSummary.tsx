/**
 * Budget Summary Component
 * Displays budget summary with progress bar and financial metrics
 */

import React, { memo } from 'react';
import { Box, Typography, LinearProgress, Chip, Stack, useTheme } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { alpha } from '@mui/material/styles';
import { AttachMoney, TrendingUp, TrendingDown } from '@mui/icons-material';
import { Card } from '../ui/Card';
import { formatCurrencyPreserveDecimals } from '../../utils/formatting';
import { getProgressColor, getStatusIcon, getBudgetTypeIcon } from '../../utils/budgetHelpers';

/**
 * Budget data interface
 */
interface Budget {
  accountId: string | null;
  categoryId: string | null;
  payeeId: string | null;
  percentageUsed: number;
  currentSpent: string;
  amount: string;
}

/**
 * BudgetSummary component props
 */
interface BudgetSummaryProps {
  budget: Budget;
  currency: string;
}

/**
 * Budget Summary Component
 */
const BudgetSummaryComponent = ({ budget, currency }: BudgetSummaryProps): React.JSX.Element => {
  const theme = useTheme();

  const budgetType = budget.accountId ? 'Account' : budget.categoryId ? 'Category' : 'Payee';
  const percentage = budget.percentageUsed;
  const spent = parseFloat(budget.currentSpent);
  const total = parseFloat(budget.amount);
  const remaining = total - spent;
  const progressColor = getProgressColor(percentage);
  const isOverBudget = percentage >= 100;

  return (
    <Card sx={{ mb: 3, p: 3 }}>
      {/* Header Section */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Chip
          icon={getBudgetTypeIcon(budget.accountId, budget.categoryId, budget.payeeId)}
          label={budgetType}
          size="small"
          variant="outlined"
        />
        <Chip
          icon={getStatusIcon(percentage)}
          label={`${percentage.toFixed(1)}% Used`}
          color={progressColor}
          variant={isOverBudget ? 'filled' : 'outlined'}
          sx={{ fontWeight: 'medium' }}
        />
      </Stack>

      {/* Progress Bar */}
      <Box sx={{ mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(percentage, 100)}
          color={progressColor}
          sx={{
            height: 12,
            borderRadius: 1,
            backgroundColor: theme.palette.action.hover,
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
            },
          }}
        />
      </Box>

      {/* Financial Metrics Grid */}
      <Grid container spacing={2}>
        {/* Budget Amount */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <AttachMoney sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary" fontWeight="medium">
                Budget
              </Typography>
            </Stack>
            <Typography variant="h6" fontWeight="bold" color="primary.main">
              {formatCurrencyPreserveDecimals(total, currency)}
            </Typography>
          </Box>
        </Grid>

        {/* Spent Amount */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: isOverBudget
                ? theme.palette.error.light
                : percentage >= 80
                  ? alpha(theme.palette.warning.main, 0.12)
                  : theme.palette.action.hover,
              border: `1px solid ${
                isOverBudget
                  ? theme.palette.error.main
                  : percentage >= 80
                    ? theme.palette.warning.main
                    : theme.palette.divider
              }`,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <TrendingUp
                sx={{
                  fontSize: 18,
                  color: isOverBudget
                    ? 'error.main'
                    : percentage >= 80
                      ? 'warning.main'
                      : 'text.secondary',
                }}
              />
              <Typography
                variant="caption"
                color={
                  isOverBudget ? 'error.main' : percentage >= 80 ? 'warning.main' : 'text.secondary'
                }
                fontWeight="medium"
              >
                Spent
              </Typography>
            </Stack>
            <Typography
              variant="h6"
              fontWeight="bold"
              color={
                isOverBudget ? 'error.main' : percentage >= 80 ? 'warning.main' : 'text.primary'
              }
            >
              {formatCurrencyPreserveDecimals(spent, currency)}
            </Typography>
          </Box>
        </Grid>

        {/* Remaining Amount */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor:
                remaining >= 0
                  ? alpha(theme.palette.success.main, 0.12)
                  : theme.palette.error.light,
              border: `1px solid ${
                remaining >= 0 ? theme.palette.success.main : theme.palette.error.main
              }`,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <TrendingDown
                sx={{
                  fontSize: 18,
                  color: remaining >= 0 ? 'success.main' : 'error.main',
                }}
              />
              <Typography
                variant="caption"
                color={remaining >= 0 ? 'success.main' : 'error.main'}
                fontWeight="medium"
              >
                Remaining
              </Typography>
            </Stack>
            <Typography
              variant="h6"
              fontWeight="bold"
              color={remaining >= 0 ? 'success.main' : 'error.main'}
            >
              {formatCurrencyPreserveDecimals(remaining, currency)}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Card>
  );
};

BudgetSummaryComponent.displayName = 'BudgetSummary';

export const BudgetSummary = memo(BudgetSummaryComponent);
