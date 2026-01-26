/**
 * Settings Resolver
 * Handles user settings GraphQL operations
 */

import type { GraphQLContext } from '../middleware/context';
import type { UserSettings } from '@prisma/client';
import { z } from 'zod';
import { validate } from '../utils/validation';
import { withPrismaErrorHandling } from '../utils/prismaErrors';

const UpdateSettingsInputSchema = z.object({
  currency: z.string().length(3).optional(),
  useThousandSeparator: z.boolean().optional(),
  colorScheme: z.string().nullable().optional(),
  colorSchemeValue: z.string().nullable().optional(),
  dateFormat: z.string().optional(),
  keypadLayout: z.string().optional(),
});

export class SettingsResolver {
  /**
   * Get user settings
   */
  async settings(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<UserSettings> {
    return await withPrismaErrorHandling(
      async () => {
        let settings = await context.prisma.userSettings.findUnique({
          where: { userId: context.userId },
        });

        // Create default settings if they don't exist
        settings ??= await context.prisma.userSettings.create({
          data: {
            userId: context.userId,
            currency: 'USD',
            useThousandSeparator: true,
            dateFormat: 'MM/DD/YYYY',
          },
        });

        return settings;
      },
      { resource: 'Settings', operation: 'read' }
    );
  }

  /**
   * Update user settings
   */
  async updateSettings(
    _: unknown,
    {
      input,
    }: {
      input: {
        currency?: string;
        useThousandSeparator?: boolean;
        colorScheme?: string | null;
        colorSchemeValue?: string | null;
        dateFormat?: string | null;
        keypadLayout?: string | null;
      };
    },
    context: GraphQLContext
  ): Promise<UserSettings> {
    const validatedInput = validate(UpdateSettingsInputSchema, input);

    return await withPrismaErrorHandling(
      async () => {
        // Upsert settings
        const settings = await context.prisma.userSettings.upsert({
          where: { userId: context.userId },
          update: {
            ...(validatedInput.currency !== undefined && {
              currency: validatedInput.currency,
            }),
            ...(validatedInput.useThousandSeparator !== undefined && {
              useThousandSeparator: validatedInput.useThousandSeparator,
            }),
            ...(validatedInput.colorScheme !== undefined && {
              colorScheme: validatedInput.colorScheme,
            }),
            ...(validatedInput.colorSchemeValue !== undefined && {
              colorSchemeValue: validatedInput.colorSchemeValue,
            }),
            ...(validatedInput.dateFormat !== undefined && {
              dateFormat: validatedInput.dateFormat,
            }),
            ...(validatedInput.keypadLayout !== undefined && {
              keypadLayout: validatedInput.keypadLayout,
            }),
          },
          create: {
            userId: context.userId,
            currency: validatedInput.currency ?? 'USD',
            useThousandSeparator: validatedInput.useThousandSeparator ?? true,
            colorScheme: validatedInput.colorScheme ?? null,
            colorSchemeValue: validatedInput.colorSchemeValue ?? null,
            dateFormat: validatedInput.dateFormat ?? 'MM/DD/YYYY',
            keypadLayout: validatedInput.keypadLayout ?? null,
          },
        });

        return settings;
      },
      { resource: 'Settings', operation: 'update' }
    );
  }
}
