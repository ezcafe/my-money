/**
 * Account Service
 * Handles business logic for account operations
 */

import type {PrismaClient} from '@prisma/client';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {DEFAULT_ACCOUNT_NAME} from '../utils/constants';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Account Service Class
 * Provides business logic methods for account operations
 * Uses dependency injection for Prisma client to enable testing and flexibility
 */
export class AccountService {
  /**
   * Constructor
   * @param prisma - Prisma client instance (injected dependency)
   */
  constructor(private readonly prisma: PrismaTransaction | PrismaClient) {}

  /**
   * Ensure a default account exists for the user
   * Creates a default account if none exists or if no default account is found
   * @param userId - User ID
   */
  async ensureDefaultAccount(userId: string): Promise<void> {
    // Check if user has a default account
    const defaultAccount = await this.prisma.account.findFirst({
      where: {
        userId,
        isDefault: true,
      },
      select: {id: true},
    });

    // If no default account exists, create one
    if (!defaultAccount) {
      await withPrismaErrorHandling(
        async () =>
          await this.prisma.account.create({
            data: {
              name: DEFAULT_ACCOUNT_NAME,
              initBalance: 0,
              balance: 0, // New account has no transactions, balance equals initBalance
              isDefault: true,
              userId,
            },
          }),
        {resource: 'Account', operation: 'create'},
      );
    }
  }
}

