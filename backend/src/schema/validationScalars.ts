/**
 * Validation Scalar Types
 * Custom scalars with built-in validation for GraphQL schema
 */

import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';

/**
 * Positive Decimal scalar - validates that value is positive
 */
export const PositiveDecimal = new GraphQLScalarType({
  name: 'PositiveDecimal',
  description: 'A positive decimal number',
  serialize(value: unknown): number {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(num) || num <= 0) {
      throw new GraphQLError('Value must be a positive number');
    }
    return num;
  },
  parseValue(value: unknown): number {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isNaN(num) || num <= 0) {
      throw new GraphQLError('Value must be a positive number');
    }
    return num;
  },
  parseLiteral(ast): number {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) {
      const num = parseFloat(ast.value);
      if (Number.isNaN(num) || num <= 0) {
        throw new GraphQLError('Value must be a positive number');
      }
      return num;
    }
    throw new GraphQLError('Value must be a number');
  },
});

/**
 * NonEmptyString scalar - validates that string is not empty
 */
export const NonEmptyString = new GraphQLScalarType({
  name: 'NonEmptyString',
  description: 'A non-empty string',
  serialize(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new GraphQLError('Value must be a non-empty string');
    }
    return value;
  },
  parseValue(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new GraphQLError('Value must be a non-empty string');
    }
    return value;
  },
  parseLiteral(ast): string {
    if (ast.kind === Kind.STRING) {
      if (ast.value.trim().length === 0) {
        throw new GraphQLError('Value must be a non-empty string');
      }
      return ast.value;
    }
    throw new GraphQLError('Value must be a string');
  },
});

/**
 * Email scalar - validates email format
 */
export const Email = new GraphQLScalarType({
  name: 'Email',
  description: 'A valid email address',
  serialize(value: unknown): string {
    const email = String(value);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new GraphQLError('Value must be a valid email address');
    }
    return email;
  },
  parseValue(value: unknown): string {
    const email = String(value);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new GraphQLError('Value must be a valid email address');
    }
    return email;
  },
  parseLiteral(ast): string {
    if (ast.kind === Kind.STRING) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ast.value)) {
        throw new GraphQLError('Value must be a valid email address');
      }
      return ast.value;
    }
    throw new GraphQLError('Value must be a string');
  },
});

/**
 * UUID scalar - validates UUID format
 */
export const UUID = new GraphQLScalarType({
  name: 'UUID',
  description: 'A valid UUID',
  serialize(value: unknown): string {
    const uuid = String(value);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        uuid
      )
    ) {
      throw new GraphQLError('Value must be a valid UUID');
    }
    return uuid;
  },
  parseValue(value: unknown): string {
    const uuid = String(value);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        uuid
      )
    ) {
      throw new GraphQLError('Value must be a valid UUID');
    }
    return uuid;
  },
  parseLiteral(ast): string {
    if (ast.kind === Kind.STRING) {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          ast.value
        )
      ) {
        throw new GraphQLError('Value must be a valid UUID');
      }
      return ast.value;
    }
    throw new GraphQLError('Value must be a string');
  },
});
