/**
 * Payee Resolver
 * Handles payee-related GraphQL operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError, ValidationError} from '../utils/errors';
import {z} from 'zod';
import {validate} from '../utils/validation';
import {withPrismaErrorHandling} from '../utils/prismaErrors';

const CreatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255),
});

const UpdatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export class PayeeResolver {
  /**
   * Ensure default payees exist
   * Creates default payees if they don't exist
   */
  private async ensureDefaultPayees(context: GraphQLContext): Promise<void> {
    const defaultPayeeNames = ['Necessities'];

    for (const name of defaultPayeeNames) {
      const existing = await context.prisma.payee.findFirst({
        where: {
          name,
          isDefault: true,
          userId: null,
        },
      });

      if (!existing) {
        await withPrismaErrorHandling(
          async () =>
            await context.prisma.payee.create({
              data: {
                name,
                isDefault: true,
                userId: null,
              },
            }),
          {resource: 'Payee', operation: 'create'},
        );
      }
    }
  }

  /**
   * Get all payees (user-specific and default)
   */
  async payees(_: unknown, __: unknown, context: GraphQLContext) {
    // Ensure default payees exist
    await this.ensureDefaultPayees(context);
    const payees = await context.prisma.payee.findMany({
      where: {
        OR: [
          {userId: context.userId},
          {isDefault: true},
        ],
      },
      orderBy: [
        {isDefault: 'desc'},
        {name: 'asc'},
      ],
    });

    return payees;
  }

  /**
   * Get payee by ID
   */
  async payee(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    const payee = await context.prisma.payee.findFirst({
      where: {
        id,
        OR: [
          {userId: context.userId},
          {isDefault: true},
        ],
      },
    });

    return payee;
  }

  /**
   * Create a new payee
   */
  async createPayee(
    _: unknown,
    {input}: {input: {name: string}},
    context: GraphQLContext,
  ) {
    const validatedInput = validate(CreatePayeeInputSchema, input);

    // Check if payee with same name already exists for this user
    const existing = await context.prisma.payee.findFirst({
      where: {
        name: validatedInput.name,
        userId: context.userId,
      },
    });

    if (existing) {
      throw new ValidationError('Payee with this name already exists');
    }

    const payee = await withPrismaErrorHandling(
      async () =>
        await context.prisma.payee.create({
          data: {
            name: validatedInput.name,
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
  ) {
    const validatedInput = validate(UpdatePayeeInputSchema, input);

    // Verify payee belongs to user (cannot update default payees)
    const existing = await context.prisma.payee.findFirst({
      where: {
        id,
        userId: context.userId,
        isDefault: false,
      },
    });

    if (!existing) {
      throw new NotFoundError('Payee');
    }

    // Check name uniqueness if name is being updated
    if (validatedInput.name && validatedInput.name !== existing.name) {
      const duplicate = await context.prisma.payee.findFirst({
        where: {
          name: validatedInput.name,
          userId: context.userId,
          id: {not: id},
        },
      });

      if (duplicate) {
        throw new ValidationError('Payee with this name already exists');
      }
    }

    const payee = await context.prisma.payee.update({
      where: {id},
      data: {
        ...(validatedInput.name !== undefined && {name: validatedInput.name}),
      },
    });

    return payee;
  }

  /**
   * Delete payee (cannot delete default payees)
   */
  async deletePayee(_: unknown, {id}: {id: string}, context: GraphQLContext) {
    const payee = await context.prisma.payee.findFirst({
      where: {
        id,
        userId: context.userId,
        isDefault: false,
      },
    });

    if (!payee) {
      throw new NotFoundError('Payee');
    }

    await context.prisma.payee.delete({
      where: {id},
    });

    return true;
  }
}

