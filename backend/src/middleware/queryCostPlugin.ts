/**
 * Query Cost Plugin
 * Calculates estimated cost of GraphQL queries based on field selections
 */

import type {GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import {GraphQLError} from 'graphql';
import type {GraphQLContext} from './context';
import {ErrorCode} from '../utils/errorCodes';

/**
 * Configuration for query cost plugin
 */
interface QueryCostConfig {
  maximumCost: number;
  baseCostPerField: number;
  costMultiplierPerDepth: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QueryCostConfig = {
  maximumCost: 100,
  baseCostPerField: 1,
  costMultiplierPerDepth: 0.5,
};

/**
 * Calculate query cost based on field count and depth
 * @param operation - GraphQL operation
 * @param config - Cost calculation configuration
 * @returns Calculated cost score
 */
function calculateQueryCost(
  operation: {selectionSet?: {selections: unknown[]}} | null | undefined,
  config: QueryCostConfig,
): number {
  if (!operation?.selectionSet) {
    return 0;
  }

  /**
   * Recursively calculate cost
   */
  function calculateCost(
    selectionSet: {selections: Array<{kind: string; selectionSet?: unknown}>} | null | undefined,
    depth: number = 0,
  ): {fieldCount: number; maxDepth: number} {
    if (!selectionSet) {
      return {fieldCount: 0, maxDepth: depth};
    }

    let fieldCount = 0;
    let maxDepth = depth;
    const maxAllowedDepth = 20; // Prevent infinite recursion

    if (depth > maxAllowedDepth) {
      return {fieldCount: 0, maxDepth: depth};
    }

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        fieldCount += 1;
        // Recurse into nested fields
        if ('selectionSet' in selection && selection.selectionSet) {
          const nested = calculateCost(selection.selectionSet as {selections: Array<{kind: string; selectionSet?: unknown}>}, depth + 1);
          fieldCount += nested.fieldCount;
          maxDepth = Math.max(maxDepth, nested.maxDepth);
        }
      }
    }

    return {fieldCount, maxDepth};
  }

  const {fieldCount, maxDepth} = calculateCost(operation.selectionSet as {selections: Array<{kind: string; selectionSet?: unknown}>} | null | undefined);

  // Calculate cost: base cost per field, multiplied by depth
  const cost = fieldCount * config.baseCostPerField * Math.max(1, maxDepth * config.costMultiplierPerDepth);

  return cost;
}

/**
 * Query cost plugin
 * Prevents queries that exceed cost limits
 * @param config - Plugin configuration
 * @returns Apollo Server plugin
 */
export function queryCostPlugin(config: Partial<QueryCostConfig> = {}): {
  requestDidStart(
    _requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
  ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>>;
} {
  const finalConfig = {...DEFAULT_CONFIG, ...config};

  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    async requestDidStart(
      _requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
    ): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      return {
        // eslint-disable-next-line @typescript-eslint/require-await
        async didResolveOperation(
          requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>,
        ): Promise<void> {
          const operation = requestContext.operation;
          if (!operation) {
            return;
          }

          const cost = calculateQueryCost(operation as unknown as {selectionSet?: {selections: Array<{kind: string; selectionSet?: unknown}>}} | null | undefined, finalConfig);

          if (cost > finalConfig.maximumCost) {
            throw new GraphQLError('Query cost exceeds maximum limit', {
              extensions: {
                code: ErrorCode.QUERY_COST_EXCEEDED,
                cost,
                maximumCost: finalConfig.maximumCost,
              },
            });
          }
        },
      };
    },
  };
}
