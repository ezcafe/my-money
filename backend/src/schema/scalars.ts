/**
 * GraphQL Scalar Type Definitions
 */

import {GraphQLScalarType, Kind} from 'graphql';
import {DateTimeResolver} from 'graphql-scalars';

export const DateTime = DateTimeResolver;

// Decimal scalar - using GraphQLFloat for now, can be enhanced later
export const Decimal = new GraphQLScalarType({
  name: 'Decimal',
  description: 'Decimal scalar type',
  serialize(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
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
 */
export const Upload = new GraphQLScalarType({
  name: 'Upload',
  description: 'File upload scalar',
  parseValue(value: unknown): unknown {
    return value;
  },
  serialize(value: unknown): unknown {
    return value;
  },
  parseLiteral(ast): string | null {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});


