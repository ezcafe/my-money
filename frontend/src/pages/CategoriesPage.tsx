/**
 * Categories Page
 * Lists all categories (default and user-specific), grouped by type
 */

import React, {memo, useMemo} from 'react';
import {Box, List, ListItemButton, ListItemText, Card, Typography, Divider} from '@mui/material';
import {useNavigate} from 'react-router';
import {useCategories} from '../hooks/useCategories';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';

/**
 * Categories Page Component
 */
const CategoriesPageComponent = (): React.JSX.Element => {
  const {categories, loading, error} = useCategories();
  const navigate = useNavigate();

  // Group categories by type, with Income first
  const groupedCategories = useMemo(() => {
    const incomeCategories = categories.filter((cat) => cat.type === 'INCOME');
    const expenseCategories = categories.filter((cat) => cat.type === 'EXPENSE');
    return [
      {type: 'INCOME' as const, label: 'Income', categories: incomeCategories},
      {type: 'EXPENSE' as const, label: 'Expense', categories: expenseCategories},
    ];
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
      <Box>
        <Card sx={{p: 4}}>
          <Box sx={{textAlign: 'center', py: 4}}>
            <Typography variant="h6" color="text.secondary" sx={{mb: 1}}>
              No Categories Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Categories help you organize your transactions. Create one to get started.
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Card>
        <List disablePadding>
          {groupedCategories.map((group, groupIndex) => {
            if (group.categories.length === 0) {
              return null;
            }

            return (
              <React.Fragment key={group.type}>
                {groupIndex > 0 && <Divider />}
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    backgroundColor: 'background.default',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{fontWeight: 500}}>
                    {group.label}
                  </Typography>
                  <Box
                    sx={{
                      ml: '10px',
                      flex: 1,
                      height: '1px',
                      backgroundColor: 'divider',
                    }}
                  />
                </Box>
                {group.categories.map((category, index) => (
                  <React.Fragment key={category.id}>
                    {index > 0 && <Divider />}
                    <ListItemButton
                      onClick={(): void => {
                        void navigate(`/categories/${category.id}`);
                      }}
                      sx={{
                        transition: 'background-color 0.2s ease',
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemText
                        primary={category.name}
                        primaryTypographyProps={{
                          variant: 'body1',
                          fontWeight: 500,
                        }}
                      />
                    </ListItemButton>
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          })}
        </List>
      </Card>
    </Box>
  );
};

CategoriesPageComponent.displayName = 'CategoriesPage';

export const CategoriesPage = memo(CategoriesPageComponent);

