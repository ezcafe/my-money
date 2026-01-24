/**
 * Custom Apollo Link for File Uploads
 * Handles multipart/form-data requests for file uploads in Apollo Client v4
 */

import { ApolloLink, Observable } from '@apollo/client';
import type { FetchResult, Operation } from '@apollo/client';
import { print } from 'graphql';
import { API_CONFIG } from '../config/api';

/**
 * Check if a value is a File object
 */
function isFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Check if an object contains File objects
 */
function hasFiles(variables: Record<string, unknown>): boolean {
  for (const value of Object.values(variables)) {
    if (isFile(value)) {
      return true;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (hasFiles(value as Record<string, unknown>)) {
        return true;
      }
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          isFile(item) ||
          (item && typeof item === 'object' && hasFiles(item as Record<string, unknown>))
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Create FormData from GraphQL operation and variables
 */
function createFormData(operation: Operation): FormData {
  const formData = new FormData();
  const map: Record<string, string[]> = {};
  let fileIndex = 0;

  /**
   * Process variables and extract files
   */
  function processVariables(obj: Record<string, unknown>, path = ''): Record<string, unknown> {
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (isFile(value)) {
        const fileKey = `${fileIndex}`;
        formData.append(fileKey, value);
        map[fileKey] = [currentPath];
        processed[key] = null; // Placeholder, will be replaced by map
        fileIndex++;
      } else if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        processed[key] = processVariables(value as Record<string, unknown>, currentPath);
      } else if (Array.isArray(value)) {
        processed[key] = value.map((item: unknown, index: number): unknown => {
          if (isFile(item)) {
            const fileKey = `${fileIndex}`;
            formData.append(fileKey, item);
            map[fileKey] = [`${currentPath}.${index}`];
            fileIndex++;
            return null;
          }
          if (item && typeof item === 'object' && !(item instanceof Date)) {
            return processVariables(item as Record<string, unknown>, `${currentPath}.${index}`);
          }
          return item;
        });
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  const processedVariables = processVariables(operation.variables as Record<string, unknown>);

  // Add operations and map to FormData
  formData.append(
    'operations',
    JSON.stringify({
      query: print(operation.query),
      variables: processedVariables,
    })
  );

  formData.append('map', JSON.stringify(map));

  return formData;
}

/**
 * Upload link for Apollo Client v4
 * Automatically converts requests with File objects to multipart/form-data
 */
export const uploadLink = new ApolloLink((operation, forward) => {
  const variables = operation.variables as Record<string, unknown>;

  // Check if this operation contains files
  if (!hasFiles(variables)) {
    // No files, use normal HTTP link
    return forward(operation);
  }

  // Has files, convert to multipart/form-data
  return new Observable<FetchResult>((observer) => {
    // Get auth token and URI from context
    const uri: string = (operation.getContext().uri as string | undefined) ?? API_CONFIG.graphqlUrl;

    // Async upload with cookie-based authentication
    void (async (): Promise<void> => {
      try {
        // With cookie-based auth, tokens are sent automatically via credentials
        // No need to add Authorization header
        const formData = createFormData(operation);
        const headers: Record<string, string> = {};

        // Add Apollo CSRF protection header for multipart requests
        // Apollo Server requires x-apollo-operation-name or apollo-require-preflight for multipart/form-data
        const operationName = operation.operationName ?? 'UploadPDF';
        headers['x-apollo-operation-name'] = operationName;

        // Don't set Content-Type - browser will set it with boundary for multipart/form-data
        // Copy other headers from context (excluding Content-Type)
        const contextHeaders =
          (operation.getContext().headers as Record<string, unknown> | undefined) ?? {};
        for (const [key, value] of Object.entries(contextHeaders)) {
          if (key.toLowerCase() !== 'content-type' && typeof value === 'string') {
            headers[key] = value;
          }
        }

        const response = await fetch(uri, {
          method: 'POST',
          headers,
          body: formData as BodyInit,
          credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as FetchResult;
        observer.next(data);
        observer.complete();
      } catch (error: unknown) {
        observer.error(error);
      }
    })();
  });
});
