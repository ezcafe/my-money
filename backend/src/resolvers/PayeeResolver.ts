/**
 * Payee Resolver
 * Handles payee-related GraphQL operations
 */


import type {GraphQLContext} from '../middleware/context';
import type {Payee} from '@prisma/client';
import {NotFoundError, ValidationError} from '../utils/errors';
import {z} from 'zod';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {sanitizeUserInput} from '../utils/sanitization';
import {BaseResolver} from './BaseResolver';

const CreatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255),
});

const UpdatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export class PayeeResolver extends BaseResolver {
  /**
   * Get all payees (user-specific and default)
   * Sorted by: isDefault (desc) → transaction count (desc) → name (asc)
   */
  async payees(_: unknown, __: unknown, context: GraphQLContext): Promise<Payee[]> {
    // Ensure default payees exist
    await this.ensureDefaultPayees(context);
    const payees = await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.findMany({
          where: {
            OR: [
              {userId: context.userId},
              {isDefault: true},
            ],
          },
          include: {
            _count: {
              select: {
                transactions: true,
              },
            },
          },
        }),
      {resource: 'Payee', operation: 'read'},
    );

    // Sort: isDefault desc → transaction count desc → name asc
    payees.sort((a, b) => {
      // Default items first
      if (a.isDefault !== b.isDefault) {
        return b.isDefault ? 1 : -1;
      }
      // Then by transaction count (most used first)
      const countDiff = (b._count.transactions ?? 0) - (a._count.transactions ?? 0);
      if (countDiff !== 0) return countDiff;
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    });

    // Map to return type without _count
    return payees.map((payee) => ({
      id: payee.id,
      name: payee.name,
      isDefault: payee.isDefault,
      userId: payee.userId,
      createdAt: payee.createdAt,
      updatedAt: payee.updatedAt,
    }));
  }

  /**
   * Get payee by ID
   */
  async payee(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<Payee | null> {
    return await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.findFirst({
          where: {
            id,
            OR: [
              {userId: context.userId},
              {isDefault: true},
            ],
          },
        }),
      {resource: 'Payee', operation: 'read'},
    );
  }

  /**
   * Create a new payee
   */
  async createPayee(
    _: unknown,
    {input}: {input: {name: string}},
    context: GraphQLContext,
  ): Promise<Payee> {
    const validatedInput = this.validateInput(CreatePayeeInputSchema, input);

    // Check if payee with same name already exists for this user
    const nameExists = await this.checkNameUniqueness(context, 'payee', validatedInput.name, context.userId);

    if (nameExists) {
      throw new ValidationError('Payee with this name already exists');
    }

    const payee = await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.create({
          data: {
            name: sanitizeUserInput(validatedInput.name),
            userId: context.userId,
            isDefault: false,
          },
        }),
      {resource: 'Payee', operation: 'create'},
    );

    return payee;
  }

  /**
   * Update payee
   */
  async updatePayee(
    _: unknown,
    {id, input}: {id: string; input: {name?: string}},
    context: GraphQLContext,
  ): Promise<Payee> {
    const validatedInput = this.validateInput(UpdatePayeeInputSchema, input);

    // Verify payee belongs to user (cannot update default payees)
    const existing = await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.findFirst({
          where: {
            id,
            userId: context.userId,
            isDefault: false,
          },
          select: {id: true, name: true},
        }),
      {resource: 'Payee', operation: 'read'},
    );

    if (!existing) {
      throw new NotFoundError('Payee');
    }

    // Check name uniqueness if name is being updated
    if (validatedInput.name && validatedInput.name !== existing.name) {
      const nameExists = await this.checkNameUniqueness(context, 'payee', validatedInput.name, context.userId, id);

      if (nameExists) {
        throw new ValidationError('Payee with this name already exists');
      }
    }

    return await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.update({
          where: {id},
          data: {
            ...(validatedInput.name !== undefined && {name: sanitizeUserInput(validatedInput.name)}),
          },
        }),
      {resource: 'Payee', operation: 'update'},
    );
  }

  /**
   * Delete payee (cannot delete default payees)
   */
  async deletePayee(_: unknown, {id}: {id: string}, context: GraphQLContext): Promise<boolean> {
    // Verify payee belongs to user and is not default
    const payee = await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.findFirst({
          where: {
            id,
            userId: context.userId,
            isDefault: false,
          },
          select: {id: true},
        }),
      {resource: 'Payee', operation: 'read'},
    );

    if (!payee) {
      throw new NotFoundError('Payee');
    }

    await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.delete({
          where: {id},
        }),
      {resource: 'Payee', operation: 'delete'},
    );

    return true;
  }
}

