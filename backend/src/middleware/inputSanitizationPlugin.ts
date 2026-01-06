/**
 * Apollo Server Plugin for Global Input Sanitization
 * Automatically sanitizes all resolver inputs to prevent XSS and injection attacks
 */

import type {ApolloServerPlugin, GraphQLRequestContext, GraphQLRequestListener} from '@apollo/server';
import type {GraphQLContext} from './context';
import {sanitizeInput} from './inputSanitization';

/**
 * Apollo Server plugin that sanitizes all resolver inputs globally
 * This ensures all string inputs are sanitized before reaching resolvers
 */
export function inputSanitizationPlugin(): ApolloServerPlugin<GraphQLContext | Record<string, never>> {
  return {
    requestDidStart(): Promise<GraphQLRequestListener<GraphQLContext | Record<string, never>>> {
      return Promise.resolve({
        async didResolveOperation(requestContext: GraphQLRequestContext<GraphQLContext | Record<string, never>>): Promise<void> {
          // Sanitize variables before they reach resolvers
          if (requestContext.request.variables) {
            requestContext.request.variables = sanitizeInput(requestContext.request.variables);
          }
        },
      });
    },
  };
}

