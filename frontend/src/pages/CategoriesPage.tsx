/**
 * Categories Page
 * Lists all categories (default and user-specific)
 */

import React, {memo} from 'react';
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
          {categories.map((category, index) => (
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
        </List>
      </Card>
    </Box>
  );
};

CategoriesPageComponent.displayName = 'CategoriesPage';

export const CategoriesPage = memo(CategoriesPageComponent);

