/**
 * GraphQL Scalar Type Definitions
 */

import {GraphQLScalarType, Kind} from 'graphql';
import {DateTimeResolver} from 'graphql-scalars';

export const DateTime = DateTimeResolver;

// Decimal scalar - handles Prisma Decimal type and standard number/string values
export const Decimal = new GraphQLScalarType({
  name: 'Decimal',
  description: 'Decimal scalar type',
  serialize(value: unknown): number | null {
    // Handle null or undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle number type (including 0)
    if (typeof value === 'number') {
      return value;
    }

    // Handle string type
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    }

    // Handle Prisma Decimal type (object with toNumber or can be converted with Number)
    if (typeof value === 'object') {
      // Check if it's a Prisma Decimal with toNumber method
      if ('toNumber' in value && typeof (value as {toNumber: () => number}).toNumber === 'function') {
        return (value as {toNumber: () => number}).toNumber();
      }

      // Try converting with Number() (works for Prisma Decimal)
      // This handles Prisma Decimal objects that can be coerced to numbers
      const numValue = Number(value);
      if (!Number.isNaN(numValue)) {
        return numValue;
      }
    }

    return null;
  },
  parseValue(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    return null;
  },
  parseLiteral(ast): number | null {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      return parseFloat(ast.value);
    }
    return null;
  },
});

/**
 * Upload scalar for file uploads
 * For Apollo Server v4, the file upload should come through as a Promise
 * that resolves to an object with filename, mimetype, encoding, and createReadStream
 */
export const Upload = new GraphQLScalarType({
  name: 'Upload',
  description: 'File upload scalar',
  parseValue(value: unknown): unknown {
    // Apollo Server v4 should pass the file upload object directly
    // If it's already a Promise, return it as-is
    if (value instanceof Promise) {
      return value;
    }
    // If it's an object with the expected structure, wrap it in a Promise
    if (value && typeof value === 'object') {
      return Promise.resolve(value);
    }
    // Otherwise, return the value as-is (will be handled by validation)
    return value;
  },
  serialize(value: unknown): unknown {
    // Upload scalar is input-only, should not serialize
    throw new Error('Upload scalar cannot be serialized');
  },
  parseLiteral(ast): string | null {
    // Upload scalar cannot be used in GraphQL literals
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});


