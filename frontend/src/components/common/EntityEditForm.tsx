/**
 * Generic Entity Edit Form Component
 * Reusable form component for creating/editing entities (Account, Category, Payee, etc.)
 */

import React, {useEffect, useCallback, type ReactNode} from 'react';
import {useNavigate, useSearchParams} from 'react-router';
import {Box, Typography, Button} from '@mui/material';
import {useMutation, useQuery, useApolloClient} from '@apollo/client/react';
import type {DocumentNode} from '@apollo/client';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {Card} from '../ui/Card';
import {TextField} from '../ui/TextField';
import {LoadingSpinner} from './LoadingSpinner';
import {ErrorAlert} from './ErrorAlert';
import {useTitle} from '../../contexts/TitleContext';
import {validateReturnUrl} from '../../utils/validation';
import {PageContainer} from './PageContainer';

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
  /** Queries to refetch after mutation (can be query names, DocumentNode objects, or objects with query and variables) */
  refetchQueries?: Array<string | DocumentNode | {query: DocumentNode; variables?: Record<string, unknown>}> | ((isEdit: boolean, entityId?: string) => Array<string | DocumentNode | {query: DocumentNode; variables?: Record<string, unknown>}>);
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
  const client = useApolloClient();
  const isEditMode = Boolean(id);

  // Build Zod schema from field configs
  const zodSchema = React.useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};
    for (const field of config.fields) {
      let fieldSchema: z.ZodTypeAny;
      if (field.type === 'number') {
        fieldSchema = z.number();
      } else {
        fieldSchema = z.string();
      }
      if (!field.required) {
        fieldSchema = fieldSchema.optional();
      }
      if (field.validate) {
        // Add custom validation using superRefine for better error message control
        fieldSchema = fieldSchema.superRefine((val, ctx) => {
          const error = field.validate?.(val);
          if (error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: error,
            });
          }
        });
      }
      schemaFields[field.key] = fieldSchema;
    }
    return z.object(schemaFields);
  }, [config.fields]);

  // Initialize react-hook-form with Zod resolver
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(zodSchema),
    defaultValues: (() => {
      const initial: Record<string, unknown> = {};
      for (const field of config.fields) {
        initial[field.key] = field.defaultValue ?? (field.type === 'number' ? 0 : '');
      }
      return initial;
    })(),
  });

  const {
    control,
    handleSubmit: handleFormSubmit,
    formState: {errors: formErrors, isSubmitting},
    reset,
    setError: setFormError,
  } = form;

  // Use formErrors directly without unnecessary type assertion
  const errors = formErrors;

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
      reset(values);
    } else if (!isEditMode) {
      // Reset form for create mode
      const values: Record<string, unknown> = {};
      for (const field of config.fields) {
        values[field.key] = field.defaultValue ?? (field.type === 'number' ? 0 : '');
      }
      reset(values);
    }
  }, [entity, isEditMode, config.fields, reset]);

  // Get refetch queries for create - support function for conditional queries
  const getCreateRefetchQueries = (): Array<string | DocumentNode | {query: DocumentNode; variables?: Record<string, unknown>}> => {
    if (!config.refetchQueries) {
      return [];
    }
    if (typeof config.refetchQueries === 'function') {
      return config.refetchQueries(false, undefined);
    }
    return config.refetchQueries;
  };

  // Get refetch queries for update - support function for conditional queries
  const getUpdateRefetchQueries = (): Array<string | DocumentNode | {query: DocumentNode; variables?: Record<string, unknown>}> => {
    if (!config.refetchQueries) {
      return [];
    }
    if (typeof config.refetchQueries === 'function') {
      return config.refetchQueries(true, id);
    }
    return config.refetchQueries;
  };

  // Create mutation with optimistic updates
  const [createEntity, {loading: creating}] = useMutation(config.createMutation, {
    refetchQueries: getCreateRefetchQueries(),
    awaitRefetchQueries: true,
    optimisticResponse: config.getOptimisticResponse
      ? (variables: {input?: TInput; id?: string}): unknown => {
          return config.getOptimisticResponse!(variables, false);
        }
      : undefined,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setFormError('root', {message: errorMessage});
    },
    onCompleted: () => {
      void (async (): Promise<void> => {
        // Manually refetch queries to ensure data is updated
        const queriesToRefetch = getCreateRefetchQueries();
        if (queriesToRefetch.length > 0) {
          try {
            for (const query of queriesToRefetch) {
              if (typeof query === 'string') {
                // String query names - only refetch if query is in cache
                await client.refetchQueries({include: [query]});
              } else if ('query' in query) {
                // Object with query and variables
                await client.query({
                  query: query.query,
                  variables: query.variables,
                  fetchPolicy: 'network-only',
                });
              } else {
                // DocumentNode object - refetch directly using the query document
                await client.refetchQueries({
                  include: [query],
                });
              }
            }
          } catch (refetchError) {
            // Silently handle refetch errors
            console.warn('Error refetching queries:', refetchError);
          }
        }
        void navigate(returnTo, {replace: true});
      })();
    },
  });

  // Update mutation with optimistic updates
  const [updateEntity, {loading: updating}] = useMutation(config.updateMutation, {
    refetchQueries: getUpdateRefetchQueries(),
    awaitRefetchQueries: true,
    optimisticResponse: config.getOptimisticResponse
      ? (variables: {input?: TInput; id?: string}): unknown => {
          return config.getOptimisticResponse!(variables, true);
        }
      : undefined,
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setFormError('root', {message: errorMessage});
    },
    onCompleted: () => {
      void navigate(returnTo);
    },
  });

  const loading = creating || updating || isSubmitting;

  /**
   * Handle form submission with react-hook-form
   */
  const onSubmit = useCallback((formValues: Record<string, unknown>): void => {
    // Validate form (if custom validation provided)
    if (config.validateForm) {
      const formError = config.validateForm(formValues);
      if (formError) {
        setFormError('root', {message: formError});
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
  }, [config, isEditMode, id, updateEntity, createEntity, setFormError]);

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

  return (
    <PageContainer
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
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
        <Box
          component="form"
          onSubmit={handleFormSubmit(onSubmit)}
          sx={{display: 'flex', flexDirection: 'column', gap: 2, flex: 1}}
        >
          {errors.root ? <Typography color="error" variant="body2">
              {(errors.root as {message?: string}).message ?? 'An error occurred'}
            </Typography> : null}

          {config.fields.map((field) => {
            if (field.type === 'custom' && field.render) {
              return (
                <Controller
                  key={field.key}
                  name={field.key}
                  control={control}
                  render={({field: {value, onChange}}) => {
                    const fieldError = errors[field.key] as {message?: string} | undefined;
                    return (
                      <Box>
                        {field.render?.(value, onChange, fieldError?.message)}
                      </Box>
                    );
                  }}
                />
              );
            }

            if (field.type === 'number') {
              return (
                <Controller
                  key={field.key}
                  name={field.key}
                  control={control}
                  render={({field: {value, onChange}}) => (
                    <TextField
                      label={field.label}
                      type="number"
                      value={typeof value === 'number' ? String(value) : value ?? ''}
                      onChange={(e) => {
                        const numValue = e.target.value === '' ? 0 : Number.parseFloat(e.target.value);
                        onChange(isNaN(numValue) ? 0 : numValue);
                      }}
                      fullWidth
                      required={field.required}
                      error={Boolean(errors[field.key])}
                      helperText={(errors[field.key] as {message?: string} | undefined)?.message}
                      inputProps={field.inputProps}
                    />
                  )}
                />
              );
            }

            // Default to text field
            return (
              <Controller
                key={field.key}
                name={field.key}
                control={control}
                render={({field: {value, onChange}}) => (
                  <TextField
                    label={field.label}
                    value={value ?? ''}
                    onChange={onChange}
                    fullWidth
                    required={field.required}
                    error={Boolean(errors[field.key])}
                    helperText={errors[field.key]?.message as string}
                    inputProps={field.inputProps}
                  />
                )}
              />
            );
          })}

          <Box sx={{display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 'auto'}}>
            <Button
              type="button"
              onClick={() => {
                void navigate(returnTo, {replace: true});
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Card>
    </PageContainer>
  );
}

