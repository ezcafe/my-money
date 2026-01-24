/**
 * GraphQL Validation Plugin
 * Validates all GraphQL inputs using Zod schemas before resolver execution
 */

import type {
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { GraphQLError, Kind } from 'graphql';
import type { GraphQLContext } from './context';
import { inputSchemas } from '../utils/validation';
import { ErrorCode } from '../utils/errorCodes';

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
function isMutation(
  operation: { operation: string } | null | undefined
): boolean {
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
      throw new GraphQLError(
        `Array size exceeds maximum of ${MAX_ARRAY_SIZE}`,
        {
          extensions: {
            code: ErrorCode.INPUT_SIZE_EXCEEDED,
            maxSize: MAX_ARRAY_SIZE,
            actualSize: inputValue.length,
          },
        }
      );
    }
    // Recursively validate array elements
    for (const element of inputValue) {
      validateInputSize(element);
    }
  } else if (typeof inputValue === 'string') {
    if (inputValue.length > MAX_STRING_LENGTH) {
      throw new GraphQLError(
        `String length exceeds maximum of ${MAX_STRING_LENGTH}`,
        {
          extensions: {
            code: ErrorCode.INPUT_SIZE_EXCEEDED,
            maxLength: MAX_STRING_LENGTH,
            actualLength: inputValue.length,
          },
        }
      );
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
 * All mutations with input parameters should be listed here for validation
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
  updatePreferences: 'updatePreferences',
  createBudget: 'createBudget',
  updateBudget: 'updateBudget',
  createWorkspace: 'createWorkspace',
  updateWorkspace: 'updateWorkspace',
  inviteUserToWorkspace: 'inviteUserToWorkspace',
  acceptWorkspaceInvitation: 'acceptWorkspaceInvitation',
  cancelWorkspaceInvitation: 'cancelWorkspaceInvitation',
  updateWorkspaceMemberRole: 'updateWorkspaceMemberRole',
  removeWorkspaceMember: 'removeWorkspaceMember',
  resolveConflict: 'resolveConflict',
  dismissConflict: 'dismissConflict',
  matchImportedTransaction: 'matchImportedTransaction',
  saveImportedTransactions: 'saveImportedTransactions',
  markBudgetNotificationRead: 'markBudgetNotificationRead',
};

/**
 * GraphQL validation plugin
 * Validates mutation inputs using Zod schemas
 * @returns Apollo Server plugin
 */
export function validationPlugin(): {
  requestDidStart(
    _requestContext: GraphQLRequestContext<
      GraphQLContext | Record<string, never>
    >
  ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>>;
} {
  return {
    requestDidStart(
      _requestContext: GraphQLRequestContext<
        GraphQLContext | Record<string, never>
      >
    ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      return Promise.resolve({
        didResolveOperation(
          requestContext: GraphQLRequestContext<
            GraphQLContext | Record<string, never>
          >
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

          // Helper function to extract value from GraphQL value node
          const extractValue = (valueNode: {
            kind: string;
            [key: string]: unknown;
          }): unknown => {
            if (valueNode.kind === (Kind.VARIABLE as string)) {
              const variableNode = valueNode as unknown as {
                name: { value: string };
              };
              const variableName = variableNode.name.value;
              return variables[variableName];
            } else if (valueNode.kind === (Kind.INT as string)) {
              const intNode = valueNode as unknown as { value: string };
              return parseInt(intNode.value, 10);
            } else if (valueNode.kind === (Kind.FLOAT as string)) {
              const floatNode = valueNode as unknown as { value: string };
              return parseFloat(floatNode.value);
            } else if (valueNode.kind === (Kind.STRING as string)) {
              const stringNode = valueNode as unknown as { value: string };
              return stringNode.value;
            } else if (valueNode.kind === (Kind.BOOLEAN as string)) {
              const boolNode = valueNode as unknown as { value: boolean };
              return boolNode.value;
            } else if (valueNode.kind === (Kind.NULL as string)) {
              return null;
            } else if (valueNode.kind === (Kind.OBJECT as string)) {
              // Inline object value - convert to plain object
              const obj: Record<string, unknown> = {};
              const objectNode = valueNode as unknown as {
                fields: Array<{ name: { value: string }; value: unknown }>;
              };
              const fields = objectNode.fields;
              for (const field of fields) {
                const fieldName = field.name.value;
                obj[fieldName] = extractValue(
                  field.value as { kind: string; [key: string]: unknown }
                );
              }
              return obj;
            } else if (valueNode.kind === (Kind.LIST as string)) {
              // Handle list values
              const listNode = valueNode as unknown as { values: unknown[] };
              const values = listNode.values;
              return values.map((val) =>
                extractValue(val as { kind: string; [key: string]: unknown })
              );
            }
            return undefined;
          };

          // Try to find input argument first (for mutations with input object)
          const inputArgument = fieldSelection.arguments?.find(
            (arg) => arg.name.value === 'input'
          );
          let inputValue: unknown;

          if (inputArgument) {
            // Mutation has input argument - extract it
            inputValue = extractValue(
              inputArgument.value as { kind: string; [key: string]: unknown }
            );
          } else {
            // Mutation doesn't have input argument - collect all arguments as an object
            const args: Record<string, unknown> = {};
            if (fieldSelection.arguments) {
              for (const arg of fieldSelection.arguments) {
                const argName = arg.name.value;
                const argValue = extractValue(
                  arg.value as { kind: string; [key: string]: unknown }
                );
                if (argValue !== undefined) {
                  args[argName] = argValue;
                }
              }
            }
            // Only validate if we have arguments
            if (Object.keys(args).length > 0) {
              inputValue = args;
            }
          }

          if (inputValue === undefined) {
            // No input to validate (e.g., delete mutations with only ID)
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
              const zodError = error as {
                issues: Array<{
                  path: Array<string | number>;
                  message: string;
                }>;
              };
              const errors = zodError.issues
                .map((issue) => {
                  const path =
                    issue.path.length > 0 ? issue.path.join('.') : 'input';
                  return `${path}: ${issue.message}`;
                })
                .join(', ');

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
