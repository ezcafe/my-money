/**
 * Payee Resolver
 * Handles payee-related GraphQL operations
 */

import type { GraphQLContext } from '../middleware/context';
import type { Payee } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { z } from 'zod';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { sanitizeUserInput } from '../utils/sanitization';
import { BaseResolver } from './BaseResolver';
import { payeeEventEmitter } from '../events';
import {
  checkWorkspaceAccess,
  getUserDefaultWorkspace,
} from '../services/WorkspaceService';
import { publishPayeeUpdate } from './SubscriptionResolver';
import { getContainer } from '../utils/container';

const CreatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255),
  workspaceId: z.string().uuid().optional(),
});

const UpdatePayeeInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  expectedVersion: z.number().int().optional(),
});

export class PayeeResolver extends BaseResolver {
  /**
   * Get all payees for the current workspace
   * Sorted by: isDefault (desc) → transaction count (desc) → name (asc)
   */
  async payees(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<Payee[]> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Ensure default payees exist before querying
    await this.ensureDefaultPayees(context, workspaceId);

    const payeeRepository = getContainer().getPayeeRepository(context.prisma);
    const payees = await withPrismaErrorHandling(
      async () => {
        const payeesList = await payeeRepository.findMany(workspaceId);
        // Get transaction counts for each payee
        const payeesWithCounts = await Promise.all(
          payeesList.map(async (payee) => {
            const count = await context.prisma.transaction.count({
              where: { payeeId: payee.id },
            });
            return { ...payee, _count: { transactions: count } };
          })
        );
        return payeesWithCounts;
      },
      { resource: 'Payee', operation: 'read' }
    );

    // Sort: isDefault desc → transaction count desc → name asc
    payees.sort((a, b) => {
      // Default items first
      if (a.isDefault !== b.isDefault) {
        return b.isDefault ? 1 : -1;
      }
      // Then by transaction count (most used first)
      const countDiff =
        (b._count?.transactions ?? 0) - (a._count?.transactions ?? 0);
      if (countDiff !== 0) return countDiff;
      // Finally alphabetical
      return a.name.localeCompare(b.name);
    });

    // Map to return type without _count
    return payees.map((payee) => {
      const { _count, ...payeeWithoutCount } = payee;
      return payeeWithoutCount;
    });
  }

  /**
   * Get payee by ID
   */
  async payee(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<Payee | null> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    const payeeRepository = getContainer().getPayeeRepository(context.prisma);
    return await payeeRepository.findById(id, workspaceId);
  }

  /**
   * Create a new payee
   */
  async createPayee(
    _: unknown,
    { input }: { input: { name: string; workspaceId?: string } },
    context: GraphQLContext
  ): Promise<Payee> {
    const validatedInput = this.validateInput(CreatePayeeInputSchema, input);

    // Get workspace ID from input or context (default to user's default workspace)
    const workspaceId =
      validatedInput.workspaceId ??
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    const payeeRepository = getContainer().getPayeeRepository(context.prisma);

    // Check if payee with same name already exists in this workspace
    const existingPayees = await payeeRepository.findMany(workspaceId);
    const nameExists = existingPayees.some(
      (payee) => payee.name === validatedInput.name
    );

    if (nameExists) {
      throw new ValidationError('Payee with this name already exists');
    }

    const payee = await withPrismaErrorHandling(
      async () =>
        await payeeRepository.create({
          name: sanitizeUserInput(validatedInput.name),
          isDefault: false,
          workspaceId,
          createdBy: context.userId,
          lastEditedBy: context.userId,
        }),
      { resource: 'Payee', operation: 'create' }
    );

    // Emit event after payee creation
    payeeEventEmitter.emit('payee.created', payee);
    publishPayeeUpdate(payee);

    return payee;
  }

  /**
   * Update payee
   */
  async updatePayee(
    _: unknown,
    {
      id,
      input,
    }: { id: string; input: { name?: string; expectedVersion?: number } },
    context: GraphQLContext
  ): Promise<Payee> {
    const validatedInput = this.validateInput(UpdatePayeeInputSchema, input);

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Verify payee belongs to workspace
    const payeeRepository = getContainer().getPayeeRepository(context.prisma);
    const existingPayee = await payeeRepository.findById(id, workspaceId);

    if (!existingPayee) {
      throw new NotFoundError('Payee');
    }

    // Store old payee for event and version tracking
    const oldPayee = { ...existingPayee };
    const versionService = getContainer().getVersionService(context.prisma);

    // Prepare new payee data
    const newPayeeData = {
      ...existingPayee,
      ...(validatedInput.name !== undefined && {
        name: sanitizeUserInput(validatedInput.name),
      }),
      version: existingPayee.version + 1,
      lastEditedBy: context.userId,
    };

    // Check for conflicts (this will throw ConflictError if version mismatch)
    await versionService.checkForConflict(
      'Payee',
      id,
      existingPayee.version,
      validatedInput.expectedVersion,
      existingPayee as unknown as Record<string, unknown>,
      newPayeeData as unknown as Record<string, unknown>,
      workspaceId
    );

    // Check name uniqueness if name is being updated
    if (validatedInput.name && validatedInput.name !== existingPayee.name) {
      const existingPayees = await payeeRepository.findMany(workspaceId);
      const nameExists = existingPayees.some(
        (payee) => payee.id !== id && payee.name === validatedInput.name
      );

      if (nameExists) {
        throw new ValidationError('Payee with this name already exists');
      }
    }

    // Update payee, create version snapshot
    await context.prisma.$transaction(async (tx) => {
      const txVersionService = getContainer().getVersionService(tx);

      // Create version snapshot before update (stores previous state)
      await txVersionService.createVersion(
        'Payee',
        id,
        existingPayee as unknown as Record<string, unknown>,
        newPayeeData as unknown as Record<string, unknown>,
        context.userId,
        tx
      );

      const txPayeeRepository = getContainer().getPayeeRepository(tx);
      await txPayeeRepository.update(id, {
        ...(validatedInput.name !== undefined && {
          name: sanitizeUserInput(validatedInput.name),
        }),
      });

      // Increment version and update lastEditedBy
      await tx.payee.update({
        where: { id },
        data: {
          version: { increment: 1 },
          lastEditedBy: context.userId,
        },
      });
    });

    // Fetch updated payee
    const updatedPayee = await payeeRepository.findById(id, workspaceId);

    if (!updatedPayee) {
      throw new NotFoundError('Payee');
    }

    // Emit event after payee update
    payeeEventEmitter.emit('payee.updated', oldPayee, updatedPayee);
    publishPayeeUpdate(updatedPayee);

    return updatedPayee;
  }

  /**
   * Delete payee (cannot delete default payees)
   */
  async deletePayee(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Verify payee belongs to workspace
    const payeeRepository = getContainer().getPayeeRepository(context.prisma);
    const payee = await payeeRepository.findById(id, workspaceId);

    if (!payee) {
      throw new NotFoundError('Payee');
    }

    // Store payee for event before deletion
    const payeeToDelete = { ...payee };

    await payeeRepository.delete(id);

    // Emit event after payee deletion
    payeeEventEmitter.emit('payee.deleted', payeeToDelete);
    publishPayeeUpdate(payeeToDelete);

    return true;
  }

  /**
   * Field resolver for versions
   */
  async versions(
    parent: Payee,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    const versionService = getContainer().getVersionService(context.prisma);
    return versionService.getEntityVersions('Payee', parent.id);
  }

  /**
   * Field resolver for createdBy
   */
  async createdBy(
    parent: Payee,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.createdBy);
  }

  /**
   * Field resolver for lastEditedBy
   */
  async lastEditedBy(
    parent: Payee,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.lastEditedBy);
  }
}
