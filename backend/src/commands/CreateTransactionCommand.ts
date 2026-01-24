/**
 * Create Transaction Command
 * CQRS command handler for creating transactions
 */

import type { GraphQLContext } from '../middleware/context';
import { createTransaction } from '../services/TransactionService';
import { getUserDefaultWorkspace } from '../services/WorkspaceService';
import { checkWorkspaceAccess } from '../services/WorkspaceService';
import { publishTransactionUpdate } from '../resolvers/SubscriptionResolver';

/**
 * Create transaction command input
 */
export interface CreateTransactionCommandInput {
  value: number;
  date?: Date;
  accountId: string;
  categoryId?: string | null;
  payeeId?: string | null;
  note?: string | null;
}

/**
 * Create transaction command handler
 */
export async function handleCreateTransaction(
  input: CreateTransactionCommandInput,
  context: GraphQLContext
): Promise<{
  id: string;
  value: number | string;
  date: Date;
  accountId: string;
  categoryId: string | null;
  payeeId: string | null;
  note: string | null;
  userId: string;
  account: unknown;
  category: unknown;
  payee: unknown;
}> {
  const workspaceId =
    context.currentWorkspaceId ??
    (await getUserDefaultWorkspace(context.userId));
  await checkWorkspaceAccess(workspaceId, context.userId);

  const result = await context.prisma.$transaction(async (tx) => {
    return createTransaction(input, context.userId, workspaceId, tx);
  });

  // Publish subscription update
  // Fetch the full transaction to publish
  const fullTransaction = await context.prisma.transaction.findUnique({
    where: { id: result.id },
  });
  if (fullTransaction) {
    publishTransactionUpdate(fullTransaction);
  }

  return result;
}
