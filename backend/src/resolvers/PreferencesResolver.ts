/**
 * Preferences Resolver
 * Handles user preferences GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {z} from 'zod';
import {validate} from '../utils/validation';

const UpdatePreferencesInputSchema = z.object({
  currency: z.string().length(3).optional(),
  useThousandSeparator: z.boolean().optional(),
});

export class PreferencesResolver {
  /**
   * Get user preferences
   */
  async preferences(_: unknown, __: unknown, context: GraphQLContext) {
    let preferences = await context.prisma.userPreferences.findUnique({
      where: {userId: context.userId},
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await context.prisma.userPreferences.create({
        data: {
          userId: context.userId,
          currency: 'USD',
          useThousandSeparator: true,
        },
      });
    }

    return preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    _: unknown,
    {input}: {input: {currency?: string; useThousandSeparator?: boolean}},
    context: GraphQLContext,
  ) {
    const validatedInput = validate(UpdatePreferencesInputSchema, input);

    // Upsert preferences
    const preferences = await context.prisma.userPreferences.upsert({
      where: {userId: context.userId},
      update: {
        ...(validatedInput.currency !== undefined && {currency: validatedInput.currency}),
        ...(validatedInput.useThousandSeparator !== undefined && {
          useThousandSeparator: validatedInput.useThousandSeparator,
        }),
      },
      create: {
        userId: context.userId,
        currency: validatedInput.currency ?? 'USD',
        useThousandSeparator: validatedInput.useThousandSeparator ?? true,
      },
    });

    return preferences;
  }
}

