/**
 * Generic Entity Edit Form Component
 * Reusable form component for creating/editing entities (Account, Category, Payee, etc.)
 */

import React, {useState, useEffect, type ReactNode} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {Box, Typography, Button} from '@mui/material';
import {useMutation, useQuery} from '@apollo/client/react';
import type {DocumentNode} from '@apollo/client';
import {Card} from '../ui/Card';
import {TextField} from '../ui/TextField';
import {LoadingSpinner} from './LoadingSpinner';
import {ErrorAlert} from './ErrorAlert';
import {useTitle} from '../../contexts/TitleContext';
import {validateReturnUrl} from '../../utils/validation';

/**
 * Field configuration for form fields
 */
export interface FormFieldConfig {
  /** Field key (used for state and form data) */
  key: string;
  /** Field label */
  label: string;
  /** Field type */
  type?: 'text' | 'number' | 'custom';
  /** Whether field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: string | number;
  /** Custom field renderer (for type: 'custom') */
  render?: (value: unknown, onChange: (value: unknown) => void, error?: string) => ReactNode;
  /** Custom validation function */
  validate?: (value: unknown) => string | null;
  /** Additional input props */
  inputProps?: Record<string, unknown>;
}

/**
 * Configuration for entity edit form
 */
export interface EntityEditFormConfig<TData = unknown, TInput = unknown> {
  /** Entity type name (e.g., 'Account', 'Category', 'Payee') */
  entityType: string;
  /** Default return URL */
  defaultReturnUrl: string;
  /** GraphQL query for fetching entity (for edit mode) */
  getQuery?: DocumentNode;
  /** GraphQL mutation for creating entity */
  createMutation: DocumentNode;
  /** GraphQL mutation for updating entity */
  updateMutation: DocumentNode;
  /** Queries to refetch after mutation */
  refetchQueries?: string[];
  /** Form fields configuration */
  fields: FormFieldConfig[];
  /** Extract entity from query data */
  extractEntity?: (data: TData) => {id: string; [key: string]: unknown} | null | undefined;
  /** Transform form values to mutation input */
  transformToInput: (values: Record<string, unknown>, isEdit: boolean) => TInput;
  /** Validate form values before submission */
  validateForm?: (values: Record<string, unknown>) => string | null;
  /** Generate optimistic response for mutations (optional) */
  getOptimisticResponse?: (variables: {input?: TInput; id?: string}, isEdit: boolean) => unknown;
}

/**
 * Props for EntityEditForm component
 */
export interface EntityEditFormProps<TData = unknown, TInput = unknown> {
  /** Entity ID (for edit mode, undefined for create mode) */
  id?: string;
  /** Form configuration */
  config: EntityEditFormConfig<TData, TInput>;
}

/**
 * Generic Entity Edit Form Component
 * Handles create/edit logic for entities with configurable fields
 */
export function EntityEditForm<TData = unknown, TInput = unknown>({
  id,
  config,
}: EntityEditFormProps<TData, TInput>): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = validateReturnUrl(searchParams.get('returnTo'), config.defaultReturnUrl);
  const {setTitle} = useTitle();
  const isEditMode = Boolean(id);

  // Initialize form state from field configs
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of config.fields) {
      initial[field.key] = field.defaultValue ?? (field.type === 'number' ? 0 : '');
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch entity data in edit mode
  const {data, loading: queryLoading, error: queryError} = useQuery<TData>(
    config.getQuery!,
    {
      variables: {id},
      skip: !id || !config.getQuery,
      errorPolicy: 'all',
    },
  );

  // Extract entity from query data
  const entity = config.extractEntity ? config.extractEntity(data as TData) : (data as {id: string; [key: string]: unknown} | null | undefined);

  // Set appbar title
  useEffect(() => {
    setTitle(isEditMode ? `Edit ${config.entityType}` : `Create ${config.entityType}`);
    return (): void => {
      setTitle(undefined);
    };
  }, [setTitle, isEditMode, config.entityType]);

  // Initialize form when entity is loaded
  useEffect(() => {
    if (entity) {
      const values: Record<string, unknown> = {};
      for (const field of config.fields) {
        values[field.key] = entity[field.key] ?? field.defaultValue ?? (field.type === 'number' ? 0 : '');
      }
      setFormValues(values);
      setError(null);
    } else if (!isEditMode) {
      // Reset form for create mode
      const values: Record<string, unknown> = {};
      for (const field of config.fields) {
        values[field.key] = field.defaultValue ?? (field.type === 'number' ? 0 : '');
      }
      setFormValues(values);
      setError(null);
    }
  }, [entity, isEditMode, config.fields]);

  // Create mutation with optimistic updates
  const [createEntity, {loading: creating}] = useMutation(config.createMutation, {
    refetchQueries: config.refetchQueries ?? [],
    awaitRefetchQueries: true,
    optimisticResponse: config.getOptimisticResponse
      ? (variables: {input?: TInput; id?: string}): unknown => {
          return config.getOptimisticResponse!(variables, false);
        }
      : undefined,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      void navigate(returnTo, {replace: true});
    },
  });

  // Update mutation with optimistic updates
  const [updateEntity, {loading: updating}] = useMutation(config.updateMutation, {
    refetchQueries: config.refetchQueries ?? [],
    awaitRefetchQueries: true,
    optimisticResponse: config.getOptimisticResponse
      ? (variables: {input?: TInput; id?: string}): unknown => {
          return config.getOptimisticResponse!(variables, true);
        }
      : undefined,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    },
    onCompleted: () => {
      setError(null);
      void navigate(returnTo);
    },
  });

  const loading = creating || updating;

  /**
   * Validate a single field
   */
  const validateField = (field: FormFieldConfig, value: unknown): string | null => {
    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${field.label} is required`;
    }
    if (field.validate) {
      return field.validate(value);
    }
    return null;
  };

  /**
   * Handle field value change with real-time validation
   */
  const handleFieldChange = (key: string, value: unknown): void => {
    setFormValues((prev) => ({...prev, [key]: value}));
    // Clear general error when user starts typing
    if (error) {
      setError(null);
    }
    // Validate field in real-time
    const field = config.fields.find((f) => f.key === key);
    if (field) {
      const fieldError = validateField(field, value);
      setFieldErrors((prev) => {
        if (fieldError) {
          return {...prev, [key]: fieldError};
        } else {
          const newErrors = {...prev};
          delete newErrors[key];
          return newErrors;
        }
      });
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (): void => {
    setError(null);
    setFieldErrors({});

    // Validate all fields
    const newFieldErrors: Record<string, string> = {};
    for (const field of config.fields) {
      const value = formValues[field.key];
      const fieldError = validateField(field, value);
      if (fieldError) {
        newFieldErrors[field.key] = fieldError;
      }
    }

    // If there are field errors, show them and don't submit
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      // Show first error as general error message
      const firstErrorKey = Object.keys(newFieldErrors)[0];
      if (firstErrorKey) {
        const firstError = newFieldErrors[firstErrorKey];
        if (typeof firstError === 'string') {
          setError(firstError);
        } else {
          setError('Please fix the form errors');
        }
      }
      return;
    }

    // Validate form (if custom validation provided)
    if (config.validateForm) {
      const formError = config.validateForm(formValues);
      if (formError) {
        setError(formError);
        return;
      }
    }

    // Transform to input format
    const input = config.transformToInput(formValues, isEditMode);

    if (isEditMode && id) {
      // Update existing entity
      void updateEntity({
        variables: {
          id,
          input,
        },
      });
    } else {
      // Create new entity
      void createEntity({
        variables: {
          input,
        },
      });
    }
  };

  // Show loading state for edit mode
  if (isEditMode && queryLoading) {
    return <LoadingSpinner message={`Loading ${config.entityType.toLowerCase()}...`} />;
  }

  // Show error state for edit mode
  if (isEditMode && queryError) {
    return (
      <ErrorAlert
        title={`Error Loading ${config.entityType}`}
        message={queryError?.message ?? `Error loading ${config.entityType.toLowerCase()} details`}
      />
    );
  }

  // Show not found state for edit mode
  if (isEditMode && !entity) {
    return (
      <ErrorAlert
        title={`${config.entityType} Not Found`}
        message={`The requested ${config.entityType.toLowerCase()} could not be found.`}
        severity="warning"
      />
    );
  }

  // Check if form is valid (for submit button disabled state)
  const isFormValid = config.fields.every((field) => {
    if (!field.required) {
      return true;
    }
    const value = formValues[field.key];
    return value && (typeof value !== 'string' || value.trim());
  });

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        width: {xs: '100%', sm: '100%'},
        maxWidth: {xs: '100%', sm: '400px'},
        mx: {xs: 0, sm: 'auto'},
      }}
    >
      <Card
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 3,
        }}
      >
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, flex: 1}}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          {config.fields.map((field) => {
            if (field.type === 'custom' && field.render) {
              return (
                <Box key={field.key}>
                  {field.render(formValues[field.key], (value) => handleFieldChange(field.key, value), error ?? undefined)}
                </Box>
              );
            }

            if (field.type === 'number') {
              const numValue = formValues[field.key];
              const numValueStr = typeof numValue === 'number' ? String(numValue) : typeof numValue === 'string' ? numValue : '';
              return (
                <TextField
                  key={field.key}
                  label={field.label}
                  type="number"
                  value={numValueStr}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  fullWidth
                  required={field.required}
                  error={Boolean(fieldErrors[field.key])}
                  helperText={fieldErrors[field.key]}
                  inputProps={field.inputProps}
                />
              );
            }

            // Default to text field
            const textValue = formValues[field.key];
            const textValueStr = typeof textValue === 'string' ? textValue : typeof textValue === 'number' ? String(textValue) : '';
            return (
              <TextField
                key={field.key}
                label={field.label}
                value={textValueStr}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                fullWidth
                required={field.required}
                error={Boolean(fieldErrors[field.key])}
                helperText={fieldErrors[field.key]}
                inputProps={field.inputProps}
              />
            );
          })}

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 'auto'}}>
            <Button
              onClick={() => {
                void navigate(returnTo, {replace: true});
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading || !isFormValid}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

