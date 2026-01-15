/**
 * Account Service
 * Handles business logic for account operations
 */

import type {PrismaClient} from '@prisma/client';
import {AccountRepository} from '../repositories/AccountRepository';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {DEFAULT_ACCOUNT_NAME} from '../utils/constants';

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
    this.accountRepository = new AccountRepository(prisma);
  }

  /**
   * Ensure a default account exists for the user
   * Creates a default account if none exists or if no default account is found
   * @param userId - User ID
   */
  async ensureDefaultAccount(userId: string): Promise<void> {
    // Check if user has a default account
    const defaultAccount = await this.accountRepository.findDefault(userId, {id: true});

    // If no default account exists, create one
    if (!defaultAccount) {
      await withPrismaErrorHandling(
        async () =>
          await this.accountRepository.create({
            name: DEFAULT_ACCOUNT_NAME,
            initBalance: 0,
            balance: 0, // New account has no transactions, balance equals initBalance
            isDefault: true,
            userId,
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

