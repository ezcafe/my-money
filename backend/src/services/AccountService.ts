/**
 * Account Service
 * Handles business logic for account operations
 */

import type {PrismaClient} from '@prisma/client';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {DEFAULTS} from '../utils/constants';
import {getContainer} from '../utils/container';
import type {AccountRepository} from '../repositories/AccountRepository';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Account Service Class
 * Provides business logic methods for account operations
 * Uses repository pattern for data access
 */
export class AccountService {
  private readonly accountRepository: AccountRepository;

  /**
   * Constructor
   * @param prisma - Prisma client instance (injected dependency)
   */
  constructor(prisma: PrismaTransaction | PrismaClient) {
    this.accountRepository = getContainer().getAccountRepository(prisma);
  }

  /**
   * Ensure default accounts exist for the workspace
   * Creates Cash, Credit Card, and Bank accounts if they don't exist
   * @param userId - User ID (for createdBy/lastEditedBy)
   * @param workspaceId - Workspace ID
   */
  async ensureDefaultAccount(userId: string, workspaceId: string): Promise<void> {
    // Ensure Cash account exists (default account)
    const cashAccount = await this.accountRepository.findDefault(workspaceId, {id: true});
    if (!cashAccount) {
      await withPrismaErrorHandling(
        async () =>
          await this.accountRepository.create({
            name: DEFAULTS.ACCOUNT_NAME,
            initBalance: 0,
            balance: 0, // New account has no transactions, balance equals initBalance
            isDefault: true,
            accountType: 'Cash',
            workspaceId,
            createdBy: userId,
            lastEditedBy: userId,
          }),
        {resource: 'Account', operation: 'create'},
      );
    }

    // Ensure Credit Card account exists (default account)
    const creditCardAccount = await this.accountRepository.findByNameAndType(
      workspaceId,
      DEFAULTS.CREDIT_CARD_ACCOUNT_NAME,
      'CreditCard',
      {id: true},
    );
    if (!creditCardAccount) {
      await withPrismaErrorHandling(
        async () =>
          await this.accountRepository.create({
            name: DEFAULTS.CREDIT_CARD_ACCOUNT_NAME,
            initBalance: 0,
            balance: 0,
            isDefault: true,
            accountType: 'CreditCard',
            workspaceId,
            createdBy: userId,
            lastEditedBy: userId,
          }),
        {resource: 'Account', operation: 'create'},
      );
    }

    // Ensure Bank account exists (default account)
    const bankAccount = await this.accountRepository.findByNameAndType(
      workspaceId,
      DEFAULTS.BANK_ACCOUNT_NAME,
      'Bank',
      {id: true},
    );
    if (!bankAccount) {
      await withPrismaErrorHandling(
        async () =>
          await this.accountRepository.create({
            name: DEFAULTS.BANK_ACCOUNT_NAME,
            initBalance: 0,
            balance: 0,
            isDefault: true,
            accountType: 'Bank',
            workspaceId,
            createdBy: userId,
            lastEditedBy: userId,
          }),
        {resource: 'Account', operation: 'create'},
      );
    }
  }

  /**
   * Get account repository instance
   * @returns Account repository
   */
  getRepository(): AccountRepository {
    return this.accountRepository;
  }
}

