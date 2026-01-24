/**
 * Workspace Detection Service
 * Detects and caches workspace assignments for imported transactions
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { getUserDefaultWorkspace } from './WorkspaceService';

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface ImportedTransactionData {
  id: string;
  transactionId?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  payeeId?: string | null;
  workspaceId: string;
  detectedWorkspaceId?: string | null;
}

/**
 * Workspace Detection Service Class
 * Provides methods for detecting and caching workspace assignments for imported transactions
 */
export class WorkspaceDetectionService {
  /**
   * Detect workspace for an imported transaction
   * Detection logic:
   * 1. If transaction is matched, use the transaction's workspace (via Account)
   * 2. If account/category/payee are suggested, check if they belong to a workspace, use that workspace
   * 3. If no match, default to importer's default workspace
   * @param importedTransaction - Imported transaction data
   * @param userId - User ID who imported the transaction
   * @param tx - Optional transaction client
   * @returns Detected workspace ID
   */
  async detectWorkspaceForTransaction(
    importedTransaction: ImportedTransactionData,
    userId: string,
    tx?: PrismaTransaction
  ): Promise<string> {
    const client = tx ?? prisma;

    // If transaction is matched, use the transaction's workspace (via Account)
    if (importedTransaction.transactionId) {
      const transaction = await client.transaction.findUnique({
        where: { id: importedTransaction.transactionId },
        include: {
          account: {
            select: { workspaceId: true },
          },
        },
      });

      if (transaction?.account.workspaceId) {
        return transaction.account.workspaceId;
      }
    }

    // If account is suggested, check if it belongs to a workspace
    if (importedTransaction.accountId) {
      const account = await client.account.findUnique({
        where: { id: importedTransaction.accountId },
        select: { workspaceId: true },
      });

      if (account?.workspaceId) {
        return account.workspaceId;
      }
    }

    // If category is suggested, check if it belongs to a workspace
    if (importedTransaction.categoryId) {
      const category = await client.category.findUnique({
        where: { id: importedTransaction.categoryId },
        select: { workspaceId: true },
      });

      if (category?.workspaceId) {
        return category.workspaceId;
      }
    }

    // If payee is suggested, check if it belongs to a workspace
    if (importedTransaction.payeeId) {
      const payee = await client.payee.findUnique({
        where: { id: importedTransaction.payeeId },
        select: { workspaceId: true },
      });

      if (payee?.workspaceId) {
        return payee.workspaceId;
      }
    }

    // If no match, default to importer's default workspace
    return getUserDefaultWorkspace(userId);
  }

  /**
   * Cache detected workspace for an imported transaction
   * @param importedTransactionId - Imported transaction ID
   * @param workspaceId - Detected workspace ID
   * @param userId - User ID (for permission check)
   * @param tx - Optional transaction client
   */
  async cacheDetectedWorkspace(
    importedTransactionId: string,
    workspaceId: string,
    userId: string,
    tx?: PrismaTransaction
  ): Promise<void> {
    const client = tx ?? prisma;

    // Verify user has access to the workspace
    const member = await client.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      // User doesn't have access, use default workspace instead
      const defaultWorkspaceId = await getUserDefaultWorkspace(userId);
      await client.importedTransaction.update({
        where: { id: importedTransactionId },
        data: { detectedWorkspaceId: defaultWorkspaceId },
      });
      return;
    }

    // Cache the detected workspace
    await client.importedTransaction.update({
      where: { id: importedTransactionId },
      data: { detectedWorkspaceId: workspaceId },
    });
  }

  /**
   * Get cached workspace for an imported transaction
   * @param importedTransactionId - Imported transaction ID
   * @returns Cached workspace ID or null
   */
  async getCachedWorkspace(
    importedTransactionId: string
  ): Promise<string | null> {
    const importedTransaction = await prisma.importedTransaction.findUnique({
      where: { id: importedTransactionId },
      select: { detectedWorkspaceId: true },
    });

    return importedTransaction?.detectedWorkspaceId ?? null;
  }

  /**
   * Clear workspace cache for an imported transaction
   * @param importedTransactionId - Imported transaction ID
   * @param tx - Optional transaction client
   */
  async clearWorkspaceCache(
    importedTransactionId: string,
    tx?: PrismaTransaction
  ): Promise<void> {
    const client = tx ?? prisma;

    await client.importedTransaction.update({
      where: { id: importedTransactionId },
      data: { detectedWorkspaceId: null },
    });
  }
}
