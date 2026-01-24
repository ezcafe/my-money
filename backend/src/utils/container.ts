/**
 * Dependency Injection Container
 * Lightweight DI container for services and repositories
 * Provides singleton instances and factory methods
 */

import type { PrismaClient } from '@prisma/client';
import type { PrismaTransaction } from '../repositories/BaseRepository';
import { AccountRepository } from '../repositories/AccountRepository';
import { CategoryRepository } from '../repositories/CategoryRepository';
import { PayeeRepository } from '../repositories/PayeeRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { BudgetRepository } from '../repositories/BudgetRepository';
import { RecurringTransactionRepository } from '../repositories/RecurringTransactionRepository';
import { AccountService } from '../services/AccountService';
import { VersionService } from '../services/VersionService';
import * as WorkspaceService from '../services/WorkspaceService';
import * as InvitationService from '../services/InvitationService';
import * as EmailService from '../services/EmailService';
import * as NotificationService from '../services/NotificationService';

/**
 * Service container interface
 */
interface ServiceContainer {
  // Repositories
  getAccountRepository(
    prisma: PrismaTransaction | PrismaClient
  ): AccountRepository;
  getCategoryRepository(
    prisma: PrismaTransaction | PrismaClient
  ): CategoryRepository;
  getPayeeRepository(prisma: PrismaTransaction | PrismaClient): PayeeRepository;
  getTransactionRepository(
    prisma: PrismaTransaction | PrismaClient
  ): TransactionRepository;
  getBudgetRepository(
    prisma: PrismaTransaction | PrismaClient
  ): BudgetRepository;
  getRecurringTransactionRepository(
    prisma: PrismaTransaction | PrismaClient
  ): RecurringTransactionRepository;

  // Services
  getAccountService(prisma: PrismaTransaction | PrismaClient): AccountService;
  getVersionService(prisma: PrismaTransaction | PrismaClient): VersionService;
  getWorkspaceService(): typeof WorkspaceService;
  getInvitationService(): typeof InvitationService;
  getEmailService(): typeof EmailService;
  getNotificationService(): typeof NotificationService;
}

/**
 * Default service container implementation
 * Creates new instances for each request (stateless)
 */
class DefaultServiceContainer implements ServiceContainer {
  /**
   * Get account repository instance
   */
  getAccountRepository(
    prisma: PrismaTransaction | PrismaClient
  ): AccountRepository {
    return new AccountRepository(prisma);
  }

  /**
   * Get category repository instance
   */
  getCategoryRepository(
    prisma: PrismaTransaction | PrismaClient
  ): CategoryRepository {
    return new CategoryRepository(prisma);
  }

  /**
   * Get payee repository instance
   */
  getPayeeRepository(
    prisma: PrismaTransaction | PrismaClient
  ): PayeeRepository {
    return new PayeeRepository(prisma);
  }

  /**
   * Get transaction repository instance
   */
  getTransactionRepository(
    prisma: PrismaTransaction | PrismaClient
  ): TransactionRepository {
    return new TransactionRepository(prisma);
  }

  /**
   * Get budget repository instance
   */
  getBudgetRepository(
    prisma: PrismaTransaction | PrismaClient
  ): BudgetRepository {
    return new BudgetRepository(prisma);
  }

  /**
   * Get recurring transaction repository instance
   */
  getRecurringTransactionRepository(
    prisma: PrismaTransaction | PrismaClient
  ): RecurringTransactionRepository {
    return new RecurringTransactionRepository(prisma);
  }

  /**
   * Get account service instance
   */
  getAccountService(prisma: PrismaTransaction | PrismaClient): AccountService {
    return new AccountService(prisma);
  }

  /**
   * Get version service instance
   */
  getVersionService(
    _prisma?: PrismaTransaction | PrismaClient
  ): VersionService {
    return new VersionService();
  }

  /**
   * Get workspace service module (functions)
   */
  getWorkspaceService(): typeof WorkspaceService {
    return WorkspaceService;
  }

  /**
   * Get invitation service module (functions)
   */
  getInvitationService(): typeof InvitationService {
    return InvitationService;
  }

  /**
   * Get email service module (functions)
   */
  getEmailService(): typeof EmailService {
    return EmailService;
  }

  /**
   * Get notification service module (functions)
   */
  getNotificationService(): typeof NotificationService {
    return NotificationService;
  }
}

/**
 * Global service container instance
 * Can be replaced for testing
 */
let container: ServiceContainer = new DefaultServiceContainer();

/**
 * Get the service container
 * @returns Service container instance
 */
export function getContainer(): ServiceContainer {
  return container;
}

/**
 * Set a custom service container (useful for testing)
 * @param newContainer - Custom container implementation
 */
export function setContainer(newContainer: ServiceContainer): void {
  container = newContainer;
}

/**
 * Reset container to default implementation
 */
export function resetContainer(): void {
  container = new DefaultServiceContainer();
}
