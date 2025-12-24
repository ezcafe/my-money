/**
 * Category Edit Page
 * Page for creating/editing category details
 */

import React, {useState, useEffect} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router';
import {Box, Typography, Button, ToggleButtonGroup, ToggleButton} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import {Card} from '../components/ui/Card';
import {TextField} from '../components/ui/TextField';
import {CREATE_CATEGORY, UPDATE_CATEGORY} from '../graphql/mutations';
import {GET_CATEGORY} from '../graphql/queries';
import {LoadingSpinner} from '../components/common/LoadingSpinner';
import {ErrorAlert} from '../components/common/ErrorAlert';
import {useTitle} from '../contexts/TitleContext';

/**
 * Category data from GraphQL query
 */
interface CategoryData {
  category?: {
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE';
    isDefault: boolean;
  } | null;
}

/**
 * Category Edit Page Component
 */
export function CategoryEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/categories';
  const {setTitle} = useTitle();
  const isEditMode = Boolean(id);

  const {data: categoryData, loading: categoryLoading, error: categoryError} = useQuery<CategoryData>(
    GET_CATEGORY,
    {
      variables: {id},
      skip: !id,
      errorPolicy: 'all',
    },
  );

  const category = categoryData?.category;

  const [name, setName] = useState('');
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [error, setError] = useState<string | null>(null);

  // Set appbar title
  useEffect(() => {
    setTitle(isEditMode ? 'Edit Category' : 'Create Category');
    // Cleanup: clear title when component unmounts
    return () => {
      setTitle(undefined);
    };
  }, [setTitle, isEditMode]);

  // Initialize form when category is loaded
  useEffect(() => {
    if (category) {
      setName(category.name);
      setCategoryType(category.type);
      setError(null);
    } else if (!isEditMode) {
      // Reset form for create mode
      setName('');
      setCategoryType('EXPENSE');
      setError(null);
    }
  }, [category, isEditMode]);

  /**
   * Validate return URL to prevent open redirects
   * Only allow relative paths starting with /
   */
  const getValidReturnUrl = (url: string): string => {
    // Only allow relative paths starting with /
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '/categories';
  };

  const [createCategory, {loading: creating}] = useMutation(CREATE_CATEGORY, {
    refetchQueries: ['GetCategories'],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL, replacing the add page in history
      // so that clicking back from the list page goes to preferences
      const validReturnUrl = getValidReturnUrl(returnTo);
      navigate(validReturnUrl, {replace: true});
    },
  });

  const [updateCategory, {loading: updating}] = useMutation(UPDATE_CATEGORY, {
    refetchQueries: ['GetCategories', 'GetCategory'],
    awaitRefetchQueries: true,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      // Navigate back to return URL
      const validReturnUrl = getValidReturnUrl(returnTo);
      navigate(validReturnUrl);
    },
  });

  const loading = creating || updating;

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (isEditMode && id) {
      // Update existing category
      void updateCategory({
        variables: {
          id,
          input: {
            name,
            type: categoryType,
          },
        },
      });
    } else {
      // Create new category
      void createCategory({
        variables: {
          input: {
            name,
            type: categoryType,
          },
        },
      });
    }
  };

  // Show loading state for edit mode
  if (isEditMode && categoryLoading) {
    return <LoadingSpinner message="Loading category..." />;
  }

  // Show error state for edit mode
  if (isEditMode && categoryError) {
    return (
      <ErrorAlert
        title="Error Loading Category"
        message={categoryError?.message ?? 'Error loading category details'}
      />
    );
  }

  // Show not found state for edit mode
  if (isEditMode && !category) {
    return (
      <ErrorAlert
        title="Category Not Found"
        message="The requested category could not be found."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{width: '100%', maxWidth: 600, mx: 'auto'}}>
      <Card sx={{p: 3}}>
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />

          <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
            <Typography variant="body2" color="text.secondary">
              Category Type
            </Typography>
            <ToggleButtonGroup
              value={categoryType}
              exclusive
              onChange={(_, newValue: string | null) => {
                if (newValue !== null && (newValue === 'INCOME' || newValue === 'EXPENSE')) {
                  setCategoryType(newValue as 'INCOME' | 'EXPENSE');
                }
              }}
              aria-label="category type"
              fullWidth
            >
              <ToggleButton value="INCOME" aria-label="income">
                Income
              </ToggleButton>
              <ToggleButton value="EXPENSE" aria-label="expense">
                Expense
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2}}>
            <Button
              onClick={() => {
                const validReturnUrl = getValidReturnUrl(returnTo);
                // Use replace to maintain clean history
                navigate(validReturnUrl, {replace: true});
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

