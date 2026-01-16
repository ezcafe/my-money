/**
 * Apollo Server Handler for Hono
 * Custom integration to connect Apollo Server with Hono framework
 */

import type {Context} from 'hono';
import type {ApolloServer} from '@apollo/server';
import type {GraphQLContext} from '../middleware/context';
import {createContext} from '../middleware/context';

/**
 * Create Apollo Server handler for Hono
 * @param server - Apollo Server instance
 * @returns Hono handler function
 */
export function createApolloHandler(
  server: ApolloServer<GraphQLContext | Record<string, never>>,
) {
  return async (c: Context): Promise<Response> => {
    try {
      // Parse query first to check if it's an introspection query
      let body: {query?: string; variables?: unknown; operationName?: string} | null = null;

      // Check if body was already parsed by multipart handler
      const preParsedBody = (c.req as {body?: unknown}).body;
      if (preParsedBody && typeof preParsedBody === 'object') {
        body = preParsedBody as {query?: string; variables?: unknown; operationName?: string};
      } else if (c.req.method === 'GET') {
        // For GET requests, parse query string
        const url = new URL(c.req.url);
        const query = url.searchParams.get('query');
        if (query) {
          body = {query};
        }
      } else {
        // For POST requests, try to get body using Hono's methods
        const requestBody = await c.req.json().catch(() => null) as {query?: string; variables?: unknown; operationName?: string} | null;
        if (requestBody && typeof requestBody === 'object') {
          body = requestBody;
        } else {
          // Body might already be consumed, try text as fallback
          const textBody = await c.req.text().catch(() => null);
          if (textBody) {
            try {
              body = JSON.parse(textBody) as {query?: string; variables?: unknown; operationName?: string};
            } catch {
              // If all else fails, body is null
            }
          }
        }
      }

      // Check if query is an introspection query
      const isIntrospection = body?.query?.includes('__schema') ?? body?.query?.includes('__type') ?? body?.query?.includes('IntrospectionQuery') ?? false;

      // Create GraphQL context from Hono context (skip for introspection queries)
      let graphQLContext: GraphQLContext | null = null;
      if (!isIntrospection) {
        graphQLContext = await createContext(c);
      }

      if (!body?.query) {
        return c.json(
          {
            errors: [
              {
                message: 'GraphQL query is required',
                extensions: {
                  code: 'BAD_REQUEST',
                },
              },
            ],
          },
          400,
        );
      }

      // Execute the GraphQL operation
      const result = await server.executeOperation(
        {
          query: body.query,
          variables: body.variables as Record<string, unknown> | undefined,
          operationName: body.operationName,
        },
        {
          contextValue: (graphQLContext ?? {}) as GraphQLContext | Record<string, never>,
        },
      );

      // Convert Apollo Server result to Hono response
      // executeOperation returns a GraphQLResponse with { body: { kind: 'single', singleResult: { data?, errors? } } } structure
      // Extract the singleResult from the body
      const response: {data?: unknown; errors?: unknown[]} = {};
      if (result && typeof result === 'object' && result.body) {
        const bodyResult = (result as {body?: {kind?: string; singleResult?: {data?: unknown; errors?: unknown[]}}}).body;
        if (bodyResult?.kind === 'single' && bodyResult.singleResult) {
          if ('data' in bodyResult.singleResult && bodyResult.singleResult.data !== undefined) {
            response.data = bodyResult.singleResult.data;
          }
          if ('errors' in bodyResult.singleResult && Array.isArray(bodyResult.singleResult.errors) && bodyResult.singleResult.errors.length > 0) {
            response.errors = bodyResult.singleResult.errors;
          }
        }
      }

      return c.json(response, 200);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      console.error('Apollo Server handler error:', errorObj);
      return c.json(
        {
          errors: [
            {
              message: errorObj.message,
              extensions: {
                code: 'INTERNAL_SERVER_ERROR',
              },
            },
          ],
        },
        500,
      );
    }
  };
}
