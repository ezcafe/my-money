/**
 * Account Resolver
 * Handles all account-related GraphQL operations
 */

import type { GraphQLContext } from '../middleware/context';
import type { Account } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { withPrismaErrorHandling } from '../utils/prismaErrors';
import { recalculateAccountBalance } from '../services/AccountBalanceService';
import { AccountService } from '../services/AccountService';
import { sanitizeUserInput } from '../utils/sanitization';
import { BaseResolver } from './BaseResolver';
import { accountEventEmitter } from '../events';
import { checkWorkspaceAccess } from '../services/WorkspaceService';
import { getUserDefaultWorkspace } from '../services/WorkspaceService';
import { publishAccountUpdate } from './SubscriptionResolver';
import { getContainer } from '../utils/container';
import { UnitOfWork } from '../utils/UnitOfWork';
import { invalidateAccountCache } from '../utils/cacheTags';
import { RequireWorkspaceAccess } from '../middleware/authorizationDecorator';

/**
 * Account with numeric balance for GraphQL responses
 */
type AccountWithNumericBalance = Omit<Account, 'initBalance' | 'balance'> & {
  initBalance: number;
  balance: number;
};

export class AccountResolver extends BaseResolver {
  /**
   * Get account service instance with context
   * @param context - GraphQL context
   * @returns Account service instance
   */
  private getAccountService(context: GraphQLContext): AccountService {
    return getContainer().getAccountService(context.prisma);
  }

  /**
   * Get all accounts for the current workspace
   * Reads balance directly from stored column for O(1) performance
   * Ensures a default account exists before returning results
   * Sorted by: isDefault (desc) → transaction count (desc) → name (asc)
   */
  @RequireWorkspaceAccess()
  async accounts(
    _: unknown,
    __: unknown,
    context: GraphQLContext
  ): Promise<Array<AccountWithNumericBalance>> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Ensure a default account exists
    const accountService = this.getAccountService(context);
    await accountService.ensureDefaultAccount(context.userId, workspaceId);

    // Fetch accounts with transaction counts using groupBy to avoid N+1 queries
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );
    const accounts = await withPrismaErrorHandling(
      async () => {
        const accountsList = await accountRepository.findMany(workspaceId);

        // Get all account IDs
        const accountIds = accountsList.map((account) => account.id);

        // Get transaction counts for all accounts in a single query using groupBy
        const transactionCounts = await context.prisma.transaction.groupBy({
          by: ['accountId'],
          where: {
            accountId: { in: accountIds },
          },
          _count: {
            id: true,
          },
        });

        // Create a map of accountId -> count for O(1) lookup
        const countMap = new Map(
          transactionCounts.map((tc) => [tc.accountId, tc._count.id])
        );

        // Merge counts with accounts
        const accountsWithCounts = accountsList.map((account) => ({
          ...account,
          _count: { transactions: countMap.get(account.id) ?? 0 },
        }));

        return accountsWithCounts;
      },
      { resource: 'Account', operation: 'read' }
    );

    // Sort: isDefault desc → transaction count desc → name asc
    accounts.sort((a, b) => {
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

    // Return accounts with balance from stored column
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
      isDefault: account.isDefault,
      accountType: account.accountType,
      workspaceId: account.workspaceId,
      version: account.version,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })) as Array<AccountWithNumericBalance>;
  }

  /**
   * Get account by ID
   * Reads balance directly from stored column for O(1) performance
   */
  async account(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<AccountWithNumericBalance | null> {
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify workspace access - fallback to default workspace if current workspace doesn't exist
    let finalWorkspaceId = workspaceId;
    try {
      await checkWorkspaceAccess(workspaceId, context.userId);
    } catch (error) {
      // If workspace doesn't exist, fall back to user's default workspace
      if (
        error instanceof NotFoundError &&
        error.message.includes('Workspace')
      ) {
        finalWorkspaceId = await getUserDefaultWorkspace(context.userId);
        await checkWorkspaceAccess(finalWorkspaceId, context.userId);
        // Update context so subsequent operations use the correct workspace
        context.currentWorkspaceId = finalWorkspaceId;
      } else {
        throw error;
      }
    }

    const account = await accountRepository.findById(id, finalWorkspaceId);

    if (!account) {
      return null;
    }

    return {
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
      accountType: account.accountType,
    } as AccountWithNumericBalance;
  }

  /**
   * Get account balance
   * Uses PostgreSQL cache to reduce database queries
   */
  @RequireWorkspaceAccess()
  async accountBalance(
    _: unknown,
    { accountId }: { accountId: string },
    context: GraphQLContext
  ): Promise<number> {
    // Check cache first
    const { getAccountBalance, setAccountBalance } =
      await import('../utils/cache');
    const cached = await getAccountBalance(accountId);
    if (cached !== null) {
      return cached;
    }

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify account belongs to workspace
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );
    const account = await accountRepository.findById(accountId, workspaceId, {
      id: true,
    });

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Use DataLoader for efficient balance calculation
    const balance = await context.accountBalanceLoader.load(accountId);

    // Cache the result
    await setAccountBalance(accountId, balance);

    return balance;
  }

  /**
   * Create a new account
   */
  @RequireWorkspaceAccess()
  async createAccount(
    _: unknown,
    {
      input,
    }: {
      input: {
        name: string;
        initBalance?: number;
        accountType?: string;
        workspaceId?: string;
      };
    },
    context: GraphQLContext
  ): Promise<AccountWithNumericBalance> {
    // Get workspace ID from input or context (default to user's default workspace)
    const workspaceId =
      input.workspaceId ??
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    const initBalance = input.initBalance ?? 0;
    const accountType =
      (input.accountType as
        | 'Cash'
        | 'CreditCard'
        | 'Bank'
        | 'Saving'
        | 'Loans') ?? 'Cash';
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );
    const account = await withPrismaErrorHandling(
      async () =>
        await accountRepository.create({
          name: sanitizeUserInput(input.name),
          initBalance,
          balance: initBalance, // New account has no transactions, balance equals initBalance
          accountType,
          workspaceId,
          createdBy: context.userId,
          lastEditedBy: context.userId,
        }),
      { resource: 'Account', operation: 'create' }
    );

    // Emit event after account creation
    accountEventEmitter.emit('account.created', account);
    publishAccountUpdate(account);
    // Invalidate cache
    await invalidateAccountCache(account.id, workspaceId).catch(() => {
      // Ignore cache errors
    });

    return {
      ...account,
      initBalance: Number(account.initBalance),
      balance: Number(account.balance),
      accountType: account.accountType,
    } as AccountWithNumericBalance;
  }

  /**
   * Update account
   */
  @RequireWorkspaceAccess()
  async updateAccount(
    _: unknown,
    {
      id,
      input,
    }: {
      id: string;
      input: {
        name?: string;
        initBalance?: number;
        accountType?: string;
        expectedVersion?: number;
      };
    },
    context: GraphQLContext
  ): Promise<AccountWithNumericBalance> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify account belongs to workspace
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );
    const existingAccount = await accountRepository.findById(id, workspaceId);

    if (!existingAccount) {
      throw new NotFoundError('Account');
    }

    // Store old account for event and version tracking
    const oldAccount = { ...existingAccount };
    const versionService = getContainer().getVersionService(context.prisma);

    // Prepare new account data
    const newAccountData = {
      ...existingAccount,
      ...(input.name !== undefined && { name: sanitizeUserInput(input.name) }),
      ...(input.initBalance !== undefined && {
        initBalance: input.initBalance,
      }),
      ...(input.accountType !== undefined && {
        accountType: input.accountType,
      }),
      version: existingAccount.version + 1,
      lastEditedBy: context.userId,
    };

    // Check for conflicts (this will throw ConflictError if version mismatch)
    await versionService.checkForConflict(
      'Account',
      id,
      existingAccount.version,
      input.expectedVersion,
      existingAccount as unknown as Record<string, unknown>,
      newAccountData as unknown as Record<string, unknown>,
      workspaceId
    );

    // Update account, create version snapshot, and recalculate balance if needed
    await UnitOfWork.create(context.prisma, async (uow) => {
      const txVersionService = getContainer().getVersionService(
        uow.getTransaction()
      );

      // Create version snapshot before update (stores previous state)
      await txVersionService.createVersion(
        'Account',
        id,
        existingAccount as unknown as Record<string, unknown>,
        newAccountData as unknown as Record<string, unknown>,
        context.userId,
        uow.getTransaction()
      );

      const txAccountRepository = uow.getAccountRepository();
      await txAccountRepository.update(id, {
        ...(input.name !== undefined && {
          name: sanitizeUserInput(input.name),
        }),
        ...(input.initBalance !== undefined && {
          initBalance: input.initBalance,
        }),
        ...(input.accountType !== undefined && {
          accountType: input.accountType as
            | 'Cash'
            | 'CreditCard'
            | 'Bank'
            | 'Saving'
            | 'Loans',
        }),
      });

      // Increment version and update lastEditedBy
      await uow.getTransaction().account.update({
        where: { id },
        data: {
          version: { increment: 1 },
          lastEditedBy: context.userId,
        },
      });

      // If initBalance changed, recalculate balance
      if (input.initBalance !== undefined) {
        await recalculateAccountBalance(id, uow.getTransaction());
      }
    });

    // Fetch updated account with balance
    const accountWithBalance = await accountRepository.findById(
      id,
      workspaceId
    );

    if (!accountWithBalance) {
      throw new NotFoundError('Account');
    }

    // Emit event after account update
    accountEventEmitter.emit('account.updated', oldAccount, accountWithBalance);
    publishAccountUpdate(accountWithBalance);
    // Invalidate cache
    await invalidateAccountCache(accountWithBalance.id, workspaceId).catch(
      () => {
        // Ignore cache errors
      }
    );

    return {
      ...accountWithBalance,
      initBalance: Number(accountWithBalance.initBalance),
      balance: Number(accountWithBalance.balance),
      accountType: accountWithBalance.accountType,
    } as AccountWithNumericBalance;
  }

  /**
   * Delete account (cannot delete default account)
   */
  @RequireWorkspaceAccess()
  async deleteAccount(
    _: unknown,
    { id }: { id: string },
    context: GraphQLContext
  ): Promise<boolean> {
    // Get workspace ID from context (default to user's default workspace)
    const workspaceId =
      context.currentWorkspaceId ??
      (await getUserDefaultWorkspace(context.userId));

    // Verify account belongs to workspace
    const accountRepository = getContainer().getAccountRepository(
      context.prisma
    );
    const account = await accountRepository.findById(id, workspaceId);

    if (!account) {
      throw new NotFoundError('Account');
    }

    // Cannot delete default account
    if (account.isDefault) {
      throw new ForbiddenError('Cannot delete default account');
    }

    // Store account for event before deletion
    const accountToDelete = { ...account };

    await accountRepository.delete(id);

    // Emit event after account deletion
    accountEventEmitter.emit('account.deleted', accountToDelete);
    publishAccountUpdate(accountToDelete);
    // Invalidate cache
    await invalidateAccountCache(accountToDelete.id, workspaceId).catch(() => {
      // Ignore cache errors
    });

    return true;
  }

  /**
   * Field resolver for versions
   */
  async versions(
    parent: Account,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    const versionService = getContainer().getVersionService(context.prisma);
    return versionService.getEntityVersions('Account', parent.id);
  }

  /**
   * Field resolver for createdBy
   */
  async createdBy(
    parent: Account,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.createdBy);
  }

  /**
   * Field resolver for lastEditedBy
   */
  async lastEditedBy(
    parent: Account,
    _: unknown,
    context: GraphQLContext
  ): Promise<unknown> {
    return context.userLoader.load(parent.lastEditedBy);
  }
}
