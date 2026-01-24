/**
 * Query Complexity Plugin
 * Analyzes GraphQL query complexity to prevent expensive queries
 */

import type {
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { GraphQLError } from 'graphql';
import type { GraphQLContext } from './context';
import { ErrorCode } from '../utils/errorCodes';

/**
 * Configuration for query complexity plugin
 */
interface QueryComplexityConfig {
  maximumComplexity: number;
  defaultComplexity: number;
  fieldWeights: Record<string, number>;
}

/**
 * Field-level complexity weights
 * Higher weights indicate more expensive operations
 */
const FIELD_WEIGHTS: Record<string, number> = {
  // Queries
  transactions: 5,
  accounts: 3,
  categories: 3,
  payees: 3,
  budgets: 3,
  reports: 10,

  // Nested relations (expensive)
  account: 2,
  category: 2,
  payee: 2,

  // Aggregations (very expensive)
  totalIncome: 8,
  totalExpense: 8,
  accountBalance: 5,

  // Default weight for unknown fields
  default: 1,
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QueryComplexityConfig = {
  maximumComplexity: 1000,
  defaultComplexity: 1,
  fieldWeights: FIELD_WEIGHTS,
};

/**
 * Calculate query complexity based on field selections with field-level weights
 * @param operation - GraphQL operation
 * @param fieldWeights - Field complexity weights
 * @returns Calculated complexity score
 */
function calculateComplexity(
  operation: { selectionSet?: { selections: unknown[] } } | null | undefined,
  fieldWeights: Record<string, number>
): number {
  if (!operation?.selectionSet) {
    return 0;
  }

  let complexity = 0;

  /**
   * Recursively count fields in selection set with weights
   */
  function countFields(
    selectionSet:
      | {
          selections: Array<{
            kind: string;
            name?: { value: string };
            selectionSet?: unknown;
          }>;
        }
      | null
      | undefined,
    depth: number = 0
  ): number {
    if (!selectionSet) {
      return 0;
    }

    let count = 0;
    const maxDepth = 10; // Prevent infinite recursion

    if (depth > maxDepth) {
      return 0;
    }

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name?.value ?? '';
        const fieldWeight =
          fieldWeights[fieldName] ?? fieldWeights.default ?? 1;
        count += fieldWeight;

        // Add complexity for nested fields (exponential growth)
        if ('selectionSet' in selection && selection.selectionSet) {
          const nestedCount = countFields(
            selection.selectionSet as {
              selections: Array<{
                kind: string;
                name?: { value: string };
                selectionSet?: unknown;
              }>;
            },
            depth + 1
          );
          count += nestedCount * (depth + 1); // Multiply by depth for nested complexity
        }
      }
    }

    return count;
  }

  complexity = countFields(
    operation.selectionSet as
      | {
          selections: Array<{
            kind: string;
            name?: { value: string };
            selectionSet?: unknown;
          }>;
        }
      | null
      | undefined
  );

  return complexity;
}

/**
 * Query complexity plugin
 * Prevents queries that exceed complexity limits
 * @param config - Plugin configuration
 * @returns Apollo Server plugin
 */
export function queryComplexityPlugin(
  config: Partial<QueryComplexityConfig> = {}
): {
  requestDidStart(
    _requestContext: GraphQLRequestContext<
      GraphQLContext | Record<string, never>
    >
  ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>>;
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    async requestDidStart(
      _requestContext: GraphQLRequestContext<
        GraphQLContext | Record<string, never>
      >
    ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      return {
        // eslint-disable-next-line @typescript-eslint/require-await
        async didResolveOperation(
          requestContext: GraphQLRequestContext<
            GraphQLContext | Record<string, never>
          >
        ): Promise<void> {
          const operation = requestContext.operation;
          if (!operation) {
            return;
          }

          // Type assertion for operation with selection set
          type OperationWithSelectionSet =
            | {
                selectionSet?: {
                  selections: Array<{
                    kind: string;
                    name?: { value: string };
                    selectionSet?: unknown;
                  }>;
                };
              }
            | null
            | undefined;

          const complexity = calculateComplexity(
            operation as unknown as OperationWithSelectionSet,
            finalConfig.fieldWeights
          );

          if (complexity > finalConfig.maximumComplexity) {
            throw new GraphQLError('Query complexity exceeds maximum limit', {
              extensions: {
                code: ErrorCode.QUERY_TOO_COMPLEX,
                complexity,
                maximumComplexity: finalConfig.maximumComplexity,
              },
            });
          }
        },
      };
    },
  };
}
