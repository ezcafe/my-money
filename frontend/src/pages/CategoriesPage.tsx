/**
 * Categories Page
 * Lists all categories (default and user-specific)
 */

import React, {memo} from 'react';
import {Box, List, ListItemButton, ListItemText, Card} from '@mui/material';
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
    return <LoadingSpinner message="Loading categories..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Error Loading Categories"
        message={error.message}
      />
    );
  }

  return (
    <Box>
      <Card>
        <List>
          {categories.map((category) => (
            <ListItemButton
              key={category.id}
              onClick={(): void => {
                void navigate(`/categories/${category.id}`);
              }}
            >
              <ListItemText primary={category.name} />
            </ListItemButton>
          ))}
        </List>
      </Card>
    </Box>
  );
};

CategoriesPageComponent.displayName = 'CategoriesPage';

export const CategoriesPage = memo(CategoriesPageComponent);

