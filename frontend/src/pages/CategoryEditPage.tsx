/**
 * Category Edit Page
 * Page for creating/editing category details
 */

import React from 'react';
import {useParams} from 'react-router';
import {Box, Typography, ToggleButtonGroup, ToggleButton} from '@mui/material';
import {EntityEditForm, type EntityEditFormConfig} from '../components/common/EntityEditForm';
import {CREATE_CATEGORY, UPDATE_CATEGORY} from '../graphql/mutations';
import {GET_CATEGORY} from '../graphql/queries';

/**
 * Category data from GraphQL query
 */
interface CategoryData {
  category?: {
    id: string;
    name: string;
    categoryType: 'Income' | 'Expense';
    isDefault: boolean;
  } | null;
}

/**
 * Category Edit Page Component
 */
export function CategoryEditPage(): React.JSX.Element {
  const {id} = useParams<{id: string}>();

  const config: EntityEditFormConfig<CategoryData, {name: string; categoryType: 'Income' | 'Expense'}> = {
    entityType: 'Category',
    defaultReturnUrl: '/categories',
    getQuery: GET_CATEGORY,
    createMutation: CREATE_CATEGORY,
    updateMutation: UPDATE_CATEGORY,
    refetchQueries: ['GetCategories', 'GetCategory'],
    fields: [
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        required: true,
        defaultValue: '',
      },
      {
        key: 'categoryType',
        label: 'Category Type',
        type: 'custom',
        required: true,
        defaultValue: 'Expense',
        render: (value: unknown, onChange: (value: unknown) => void): React.JSX.Element => {
          const categoryType: 'Income' | 'Expense' = value === 'Income' || value === 'Expense' ? value : 'Expense';
          return (
            <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
              <Typography variant="body2" color="text.secondary">
                Category Type
              </Typography>
              <ToggleButtonGroup
                value={categoryType}
                exclusive
                onChange={(_, newValue: string | null) => {
                  if (newValue !== null && (newValue === 'Income' || newValue === 'Expense')) {
                    onChange(newValue);
                  }
                }}
                aria-label="category type"
                fullWidth
              >
                <ToggleButton value="Income" aria-label="income">
                  Income
                </ToggleButton>
                <ToggleButton value="Expense" aria-label="expense">
                  Expense
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          );
        },
      },
    ],
    extractEntity: (data: CategoryData): {id: string; [key: string]: unknown} | null => data?.category ?? null,
    transformToInput: (values: Record<string, unknown>) => {
      const nameValue = values.name;
      const nameStr = typeof nameValue === 'string' ? nameValue : typeof nameValue === 'number' ? String(nameValue) : '';
      return {
        name: nameStr,
        categoryType: (values.categoryType as 'Income' | 'Expense') ?? 'Expense',
      };
    },
  };

  return <EntityEditForm id={id} config={config} />;
}

