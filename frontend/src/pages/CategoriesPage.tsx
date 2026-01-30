/**
 * Categories Page
 * Lists all categories (default and user-specific), grouped by type
 * Features search, visual indicators, and improved UX
 */

import React, { memo, useMemo } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import { TrendingUp, TrendingDown, Star, Category, ChevronRight } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useCategories } from '../hooks/useCategories';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { PageContainer } from '../components/common/PageContainer';
import { useLocationRefetch, useSearchFilter } from '../hooks';

/**
 * Categories Page Component
 */
const CategoriesPageComponent = (): React.JSX.Element => {
  const { categories, loading, error, refetch } = useCategories();
  const navigate = useNavigate();

  // Refetch when returning from create page
  useLocationRefetch({
    refetchFunctions: [refetch],
    watchPathname: '/categories',
  });

  /**
   * Filter categories based on search query (non-urgent update)
   */
  const {
    filteredItems: filteredCategories,
    hasNoSearchResults,
    searchQuery,
  } = useSearchFilter({
    items: categories,
    getSearchableText: (cat) => cat.name,
  });

  /**
   * Group categories by type, with Income first
   */
  const groupedCategories = useMemo(() => {
    const incomeCategories = filteredCategories.filter((cat) => cat.categoryType === 'Income');
    const expenseCategories = filteredCategories.filter((cat) => cat.categoryType === 'Expense');
    return [
      { type: 'Income' as const, label: 'Income', categories: incomeCategories, icon: TrendingUp },
      {
        type: 'Expense' as const,
        label: 'Expense',
        categories: expenseCategories,
        icon: TrendingDown,
      },
    ];
  }, [filteredCategories]);

  /**
   * Get total counts for each type
   */
  const totalCounts = useMemo(() => {
    const incomeCount = categories.filter((cat) => cat.categoryType === 'Income').length;
    const expenseCount = categories.filter((cat) => cat.categoryType === 'Expense').length;
    return { income: incomeCount, expense: expenseCount };
  }, [categories]);

  if (loading) {
    return <LoadingSpinner useSkeleton skeletonVariant="list" skeletonCount={5} />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Categories"
        message={error.message}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={<Category />}
        title="No Categories Yet"
        description="Categories help you organize your transactions. Create one to get started."
      />
    );
  }

  return (
    <PageContainer>
      {/* No Search Results */}
      {hasNoSearchResults ? (
        <EmptyState title="No categories found" description="Try adjusting your search query" />
      ) : null}

      {/* Categories List */}
      {filteredCategories.length > 0 ? (
        <Card>
          <List disablePadding>
            {groupedCategories.map((group, groupIndex) => {
              if (group.categories.length === 0) {
                return null;
              }

              const IconComponent = group.icon;
              const totalCount = group.type === 'Income' ? totalCounts.income : totalCounts.expense;
              const filteredCount = group.categories.length;

              return (
                <React.Fragment key={group.type}>
                  {groupIndex > 0 && <Divider />}
                  <Box
                    sx={{
                      px: 3,
                      py: 1,
                      backgroundColor: 'background.default',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <IconComponent
                      fontSize="small"
                      color={group.type === 'Income' ? 'success' : 'error'}
                    />
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {group.label}
                    </Typography>
                    {searchQuery && filteredCount < totalCount ? (
                      <Chip
                        label={`${filteredCount} of ${totalCount}`}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                      />
                    ) : null}
                    {!searchQuery && (
                      <Chip
                        label={totalCount}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  {group.categories.map((category, index) => (
                    <React.Fragment key={category.id}>
                      {index > 0 && <Divider />}
                      <ListItemButton
                        onClick={(): void => {
                          void navigate(`/categories/${category.id}`);
                        }}
                        sx={{
                          py: 1.5,
                          px: 3,
                          transition: 'background-color 0.2s ease',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body1" fontWeight={500}>
                                {category.name}
                              </Typography>
                              {category.isDefault ? (
                                <Chip
                                  icon={<Star fontSize="inherit" />}
                                  label="Default"
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    '& .MuiChip-icon': {
                                      fontSize: '0.75rem',
                                    },
                                  }}
                                />
                              ) : null}
                            </Stack>
                          }
                          primaryTypographyProps={{ component: 'div' }}
                        />
                        <ListItemIcon sx={{ minWidth: 'auto' }}>
                          <ChevronRight color="action" />
                        </ListItemIcon>
                      </ListItemButton>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </List>
        </Card>
      ) : null}
    </PageContainer>
  );
};

CategoriesPageComponent.displayName = 'CategoriesPage';

export const CategoriesPage = memo(CategoriesPageComponent);
