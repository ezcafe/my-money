/**
 * GraphQL Validation Plugin
 * Validates all GraphQL inputs using Zod schemas before resolver execution
 */

import type {
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import {GraphQLError, Kind} from 'graphql';
import type {GraphQLContext} from './context';
import {inputSchemas} from '../utils/validation';
import {ErrorCode} from '../utils/errorCodes';

/**
 * Maximum allowed array size
 */
const MAX_ARRAY_SIZE = 100;

/**
 * Maximum allowed string length
 */
const MAX_STRING_LENGTH = 10000;

/**
 * Check if operation is a mutation
 */
function isMutation(operation: {operation: string} | null | undefined): boolean {
  return operation?.operation === 'mutation';
}

/**
 * Validate input size limits (array size and string length)
 * @param inputValue - Input value to validate
 * @throws GraphQLError if size limits are exceeded
 */
function validateInputSize(inputValue: unknown): void {
  if (Array.isArray(inputValue)) {
    if (inputValue.length > MAX_ARRAY_SIZE) {
      throw new GraphQLError(`Array size exceeds maximum of ${MAX_ARRAY_SIZE}`, {
        extensions: {
          code: ErrorCode.INPUT_SIZE_EXCEEDED,
          maxSize: MAX_ARRAY_SIZE,
          actualSize: inputValue.length,
        },
      });
    }
    // Recursively validate array elements
    for (const element of inputValue) {
      validateInputSize(element);
    }
  } else if (typeof inputValue === 'string') {
    if (inputValue.length > MAX_STRING_LENGTH) {
      throw new GraphQLError(`String length exceeds maximum of ${MAX_STRING_LENGTH}`, {
        extensions: {
          code: ErrorCode.INPUT_SIZE_EXCEEDED,
          maxLength: MAX_STRING_LENGTH,
          actualLength: inputValue.length,
        },
      });
    }
  } else if (inputValue !== null && typeof inputValue === 'object') {
    // Recursively validate object properties
    for (const value of Object.values(inputValue)) {
      validateInputSize(value);
    }
  }
}

/**
 * Map of mutation names to their input schema names
 */
const mutationInputSchemaMap: Record<string, keyof typeof inputSchemas> = {
  createAccount: 'createAccount',
  updateAccount: 'updateAccount',
  createCategory: 'createCategory',
  updateCategory: 'updateCategory',
  createPayee: 'createPayee',
  updatePayee: 'updatePayee',
  createTransaction: 'createTransaction',
  updateTransaction: 'updateTransaction',
  createRecurringTransaction: 'createRecurringTransaction',
  updateRecurringTransaction: 'updateRecurringTransaction',
};

/**
 * GraphQL validation plugin
 * Validates mutation inputs using Zod schemas
 * @returns Apollo Server plugin
 */
export function validationPlugin(): {
  requestDidStart(
    _requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
  ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>>;
} {
  return {
    requestDidStart(
      _requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
    ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      return Promise.resolve({
        didResolveOperation(
          requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
        ): Promise<void> {
          // Only validate mutations
          if (!isMutation(requestContext.operation)) {
            return Promise.resolve();
          }

          const operationName = requestContext.operationName;
          if (!operationName) {
            return Promise.resolve();
          }

          // Find the schema for this mutation
          const schemaName = mutationInputSchemaMap[operationName];
          if (!schemaName) {
            // No validation schema defined for this mutation
            return Promise.resolve();
          }

          const schema = inputSchemas[schemaName];
          if (!schema) {
            return Promise.resolve();
          }

          // Extract input from variables
          const variables = requestContext.request.variables;
          if (!variables) {
            return Promise.resolve();
          }

          // Find the input argument in the mutation
          const operation = requestContext.operation;
          if (!operation) {
            return Promise.resolve();
          }
          const selectionSet = operation.selectionSet;
          if (!selectionSet) {
            return Promise.resolve();
          }

          // Get the first field selection (mutation)
          const fieldSelection = selectionSet.selections[0];
          if (!fieldSelection || fieldSelection.kind !== Kind.FIELD) {
            return Promise.resolve();
          }

          // Find the input argument
          const inputArgument = fieldSelection.arguments?.find((arg) => arg.name.value === 'input');
          if (!inputArgument) {
            // Some mutations might not have input (e.g., delete mutations)
            return Promise.resolve();
          }

          // Get input value from variables
          let inputValue: unknown;
          if (inputArgument.value.kind === Kind.VARIABLE) {
            const variableName = inputArgument.value.name.value;
            inputValue = variables[variableName];
          } else if (inputArgument.value.kind === Kind.OBJECT) {
            // Inline object value - convert to plain object
            inputValue = {};
            for (const field of inputArgument.value.fields) {
              const fieldName = field.name.value;
              let fieldValue: unknown;
              if (field.value.kind === Kind.VARIABLE) {
                fieldValue = variables[field.value.name.value];
              } else if (field.value.kind === Kind.INT) {
                fieldValue = parseInt(field.value.value, 10);
              } else if (field.value.kind === Kind.FLOAT) {
                fieldValue = parseFloat(field.value.value);
              } else if (field.value.kind === Kind.STRING) {
                fieldValue = field.value.value;
              } else if (field.value.kind === Kind.BOOLEAN) {
                fieldValue = field.value.value;
              } else if (field.value.kind === Kind.NULL) {
                fieldValue = null;
              } else {
                // Skip complex values for now
                continue;
              }
              (inputValue as Record<string, unknown>)[fieldName] = fieldValue;
            }
          }

          if (inputValue === undefined) {
            return Promise.resolve();
          }

          // Validate input size limits before Zod validation
          validateInputSize(inputValue);

          // Validate input
          try {
            schema.parse(inputValue);
          } catch (error: unknown) {
            if (error && typeof error === 'object' && 'issues' in error) {
              // Zod validation error
              const zodError = error as {issues: Array<{path: Array<string | number>; message: string}>};
              const errors = zodError.issues.map((issue) => {
                const path = issue.path.length > 0 ? issue.path.join('.') : 'input';
                return `${path}: ${issue.message}`;
              }).join(', ');

              throw new GraphQLError(`Validation error: ${errors}`, {
                extensions: {
                  code: ErrorCode.BAD_USER_INPUT,
                  validationErrors: zodError.issues,
                },
              });
            }
            throw error;
          }
          return Promise.resolve();
        },
      });
    },
  };
}
