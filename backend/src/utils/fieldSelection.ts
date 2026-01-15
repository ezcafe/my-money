/**
 * GraphQL Field Selection Utilities
 * Parses GraphQL field selections to optimize database queries
 */

import type {GraphQLResolveInfo} from 'graphql';
import {Kind} from 'graphql';

/**
 * Check if a field is requested in the GraphQL query
 * @param info - GraphQL resolve info
 * @param fieldName - Field name to check
 * @returns True if field is requested, false otherwise
 */
export function isFieldRequested(info: GraphQLResolveInfo, fieldName: string): boolean {
  const fieldNode = info.fieldNodes.find((node) => node.name.value === info.fieldName);
  if (!fieldNode?.selectionSet) {
    return false;
  }

  return fieldNode.selectionSet.selections.some((selection) => {
    if (selection.kind === Kind.FIELD) {
      return selection.name.value === fieldName;
    }
    return false;
  });
}

/**
 * Get all requested field names from GraphQL query
 * @param info - GraphQL resolve info
 * @returns Array of requested field names
 */
export function getRequestedFields(info: GraphQLResolveInfo): string[] {
  const fieldNode = info.fieldNodes.find((node) => node.name.value === info.fieldName);
  if (!fieldNode?.selectionSet) {
    return [];
  }

  const fields: string[] = [];
  for (const selection of fieldNode.selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      fields.push(selection.name.value);
    }
  }
  return fields;
}

/**
 * Build Prisma select clause based on requested GraphQL fields
 * @param info - GraphQL resolve info
 * @param availableFields - Array of available fields that can be selected
 * @param relationFields - Map of relation field names to their available sub-fields
 * @returns Prisma select clause or undefined if all fields should be included
 */
export function buildSelectClause(
  info: GraphQLResolveInfo,
  availableFields: string[],
  relationFields?: Record<string, string[]>,
): Record<string, boolean> | undefined {
  const requestedFields = getRequestedFields(info);

  // If no fields are requested or all fields are requested, return undefined (include all)
  if (requestedFields.length === 0) {
    return undefined;
  }

  // Check if we should use select (only if some fields are not requested)
  const shouldUseSelect = availableFields.some((field) => !requestedFields.includes(field));

  if (!shouldUseSelect) {
    return undefined;
  }

  // Build select clause
  const select: Record<string, boolean> = {};

  // Add requested scalar fields
  for (const field of requestedFields) {
    if (availableFields.includes(field)) {
      select[field] = true;
    }
  }

  // Add relation fields if requested
  if (relationFields) {
    for (const [relationName] of Object.entries(relationFields)) {
      if (requestedFields.includes(relationName)) {
        // For relations, we can't use select with nested fields easily
        // So we'll include the relation if requested
        // The actual field selection will be handled by DataLoaders
        select[relationName] = true;
      }
    }
  }

  return select;
}

/**
 * Check if a relation field should be included in the query
 * @param info - GraphQL resolve info
 * @param relationName - Relation field name
 * @returns True if relation should be included, false otherwise
 */
export function shouldIncludeRelation(info: GraphQLResolveInfo, relationName: string): boolean {
  return isFieldRequested(info, relationName);
}
