/**
 * Preferences Resolver
 * Handles user preferences GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {UserPreferences} from '@prisma/client';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {withPrismaErrorHandling} from '../utils/prismaErrors';

const UpdatePreferencesInputSchema = z.object({
  currency: z.string().length(3).optional(),
  useThousandSeparator: z.boolean().optional(),
  colorScheme: z.string().nullable().optional(),
  colorSchemeValue: z.string().nullable().optional(),
  dateFormat: z.string().optional(),
});

export class PreferencesResolver {
  /**
   * Get user preferences
   */
  async preferences(_: unknown, __: unknown, context: GraphQLContext): Promise<UserPreferences> {
    return await withPrismaErrorHandling(
      async () => {
        let preferences = await context.prisma.userPreferences.findUnique({
          where: {userId: context.userId},
        });

        // Create default preferences if they don't exist
        preferences ??= await context.prisma.userPreferences.create({
          data: {
            userId: context.userId,
            currency: 'USD',
            useThousandSeparator: true,
            dateFormat: 'MM/DD/YYYY',
          },
        });

        return preferences;
      },
      {resource: 'Preferences', operation: 'read'},
    );
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    _: unknown,
    {input}: {input: {currency?: string; useThousandSeparator?: boolean; colorScheme?: string | null; colorSchemeValue?: string | null; dateFormat?: string | null}},
    context: GraphQLContext,
  ): Promise<UserPreferences> {
    const validatedInput = validate(UpdatePreferencesInputSchema, input);

    return await withPrismaErrorHandling(
      async () => {
        // Upsert preferences
        const preferences = await context.prisma.userPreferences.upsert({
          where: {userId: context.userId},
          update: {
            ...(validatedInput.currency !== undefined && {currency: validatedInput.currency}),
            ...(validatedInput.useThousandSeparator !== undefined && {
              useThousandSeparator: validatedInput.useThousandSeparator,
            }),
            ...(validatedInput.colorScheme !== undefined && {colorScheme: validatedInput.colorScheme}),
            ...(validatedInput.colorSchemeValue !== undefined && {colorSchemeValue: validatedInput.colorSchemeValue}),
            ...(validatedInput.dateFormat !== undefined && {dateFormat: validatedInput.dateFormat}),
          },
          create: {
            userId: context.userId,
            currency: validatedInput.currency ?? 'USD',
            useThousandSeparator: validatedInput.useThousandSeparator ?? true,
            colorScheme: validatedInput.colorScheme ?? null,
            colorSchemeValue: validatedInput.colorSchemeValue ?? null,
            dateFormat: validatedInput.dateFormat ?? 'MM/DD/YYYY',
          },
        });

        return preferences;
      },
      {resource: 'Preferences', operation: 'update'},
    );
  }
}

