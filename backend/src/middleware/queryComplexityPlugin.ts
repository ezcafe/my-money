/**
 * Query Complexity Plugin
 * Analyzes GraphQL query complexity to prevent expensive queries
 */

import type {GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import {GraphQLError} from 'graphql';
import type {GraphQLContext} from './context';
import {ErrorCode} from '../utils/errorCodes';

/**
 * Configuration for query complexity plugin
 */
interface QueryComplexityConfig {
  maximumComplexity: number;
  defaultComplexity: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QueryComplexityConfig = {
  maximumComplexity: 1000,
  defaultComplexity: 1,
};

/**
 * Calculate query complexity based on field selections
 * @param operation - GraphQL operation
 * @returns Calculated complexity score
 */
function calculateComplexity(operation: {selectionSet?: {selections: unknown[]}} | null | undefined): number {
  if (!operation?.selectionSet) {
    return 0;
  }

  let complexity = 0;

  /**
   * Recursively count fields in selection set
   */
  function countFields(selectionSet: {selections: Array<{kind: string; selectionSet?: unknown}>} | null | undefined, depth: number = 0): number {
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
        count += 1;
        // Add complexity for nested fields (exponential growth)
        if ('selectionSet' in selection && selection.selectionSet) {
          const nestedCount = countFields(selection.selectionSet as {selections: Array<{kind: string; selectionSet?: unknown}>}, depth + 1);
          count += nestedCount * (depth + 1); // Multiply by depth for nested complexity
        }
      }
    }

    return count;
  }

  complexity = countFields(operation.selectionSet as {selections: Array<{kind: string; selectionSet?: unknown}>} | null | undefined);

  return complexity;
}

/**
 * Query complexity plugin
 * Prevents queries that exceed complexity limits
 * @param config - Plugin configuration
 * @returns Apollo Server plugin
 */
export function queryComplexityPlugin(config: Partial<QueryComplexityConfig> = {}): {
  requestDidStart(
    _requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
  ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>>;
} {
  const finalConfig = {...DEFAULT_CONFIG, ...config};

  return {
    async requestDidStart(
      _requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
    ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      return {
        async didResolveOperation(
          requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
        ): Promise<void> {
          const operation = requestContext.operation;
          if (!operation) {
            return;
          }

          const complexity = calculateComplexity(operation as unknown as {selectionSet?: {selections: Array<{kind: string; selectionSet?: unknown}>}} | null | undefined);

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
