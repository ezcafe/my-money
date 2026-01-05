/**
 * Categories Page
 * Lists all categories (default and user-specific), grouped by type
 * Features search, visual indicators, and improved UX
 */

import React, {memo, useMemo, useState, useCallback} from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  InputAdornment,
  Chip,
  Stack,
  IconButton,
} from '@mui/material';
import {Search as SearchIcon, Clear as ClearIcon, TrendingUp, TrendingDown, Star, Category} from '@mui/icons-material';
import {useNavigate} from 'react-router';
import {useCategories} from '../hooks/useCategories';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {EmptyState} from '../components/common/EmptyState';
import {Card} from '../components/ui/Card';
import {TextField} from '../components/ui/TextField';

/**
 * Categories Page Component
 */
const CategoriesPageComponent = (): React.JSX.Element => {
  const {categories, loading, error} = useCategories();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Filter categories based on search query
   */
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories;
    }
    const query = searchQuery.toLowerCase().trim();
    return categories.filter((cat) => cat.name.toLowerCase().includes(query));
  }, [categories, searchQuery]);

  /**
   * Group categories by type, with Income first
   */
  const groupedCategories = useMemo(() => {
    const incomeCategories = filteredCategories.filter((cat) => cat.type === 'INCOME');
    const expenseCategories = filteredCategories.filter((cat) => cat.type === 'EXPENSE');
    return [
      {type: 'INCOME' as const, label: 'Income', categories: incomeCategories, icon: TrendingUp},
      {type: 'EXPENSE' as const, label: 'Expense', categories: expenseCategories, icon: TrendingDown},
    ];
  }, [filteredCategories]);

  /**
   * Get total counts for each type
   */
  const totalCounts = useMemo(() => {
    const incomeCount = categories.filter((cat) => cat.type === 'INCOME').length;
    const expenseCount = categories.filter((cat) => cat.type === 'EXPENSE').length;
    return {income: incomeCount, expense: expenseCount};
  }, [categories]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  /**
   * Clear search query
   */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

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

  const hasSearchResults = filteredCategories.length > 0;
  const hasNoSearchResults = searchQuery.trim() && !hasSearchResults;

  return (
    <Box>
      {/* Search Bar */}
      <Card sx={{mb: 2, p: 2}}>
        <TextField
          fullWidth
          placeholder="Search categories..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch} edge="end" aria-label="clear search">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper',
            },
          }}
        />
      </Card>

      {/* No Search Results */}
      {hasNoSearchResults && (
        <EmptyState
          title="No categories found"
          description="Try adjusting your search query"
        />
      )}

      {/* Categories List */}
      {hasSearchResults && (
        <Card>
          <List disablePadding>
            {groupedCategories.map((group, groupIndex) => {
              if (group.categories.length === 0) {
                return null;
              }

              const IconComponent = group.icon;
              const totalCount = group.type === 'INCOME' ? totalCounts.income : totalCounts.expense;
              const filteredCount = group.categories.length;

              return (
                <React.Fragment key={group.type}>
                  {groupIndex > 0 && <Divider />}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      backgroundColor: 'background.default',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <IconComponent fontSize="small" color={group.type === 'INCOME' ? 'success' : 'error'} />
                    <Typography variant="subtitle2" color="text.secondary" sx={{fontWeight: 600}}>
                      {group.label}
                    </Typography>
                    {searchQuery && filteredCount < totalCount && (
                      <Chip
                        label={`${filteredCount} of ${totalCount}`}
                        size="small"
                        variant="outlined"
                        sx={{ml: 'auto', height: 20, fontSize: '0.7rem'}}
                      />
                    )}
                    {!searchQuery && (
                      <Chip
                        label={totalCount}
                        size="small"
                        variant="outlined"
                        sx={{ml: 'auto', height: 20, fontSize: '0.7rem'}}
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
                          px: 2,
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
                              {category.isDefault && (
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
                              )}
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </List>
        </Card>
      )}
    </Box>
  );
};

CategoriesPageComponent.displayName = 'CategoriesPage';

export const CategoriesPage = memo(CategoriesPageComponent);

