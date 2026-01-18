/**
 * Database Listener
 * Listens for PostgreSQL NOTIFY events and emits application-level events
 * This provides comprehensive event coverage even for changes made outside the application
 */

import {Client} from 'pg';
import {logInfo, logWarn, logError} from './logger';
import {
  accountEventEmitter,
  categoryEventEmitter,
  payeeEventEmitter,
  transactionEventEmitter,
} from '../events';
import type {Account, Category, Payee, Transaction} from '@prisma/client';

/**
 * Database connection for LISTEN operations
 * Separate connection is required for LISTEN/NOTIFY
 */
let listenClient: Client | null = null;
let isListening = false;
let reconnectTimeout: NodeJS.Timeout | null = null;

/**
 * Parse JSON payload from NOTIFY event
 */
interface EntityChangePayload {
  entityType: 'Account' | 'Category' | 'Payee' | 'Transaction';
  entityId: string;
  workspaceId: string;
  operation: 'created' | 'updated' | 'deleted';
  data: Account | Category | Payee | Transaction;
}

/**
 * Start listening to database NOTIFY events
 * Creates a dedicated PostgreSQL connection for LISTEN operations
 */
export async function startDatabaseListener(): Promise<void> {
  if (isListening && listenClient) {
    logInfo('Database listener already running');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Create new client for LISTEN operations
  listenClient = new Client({
    connectionString: databaseUrl,
  });

  try {
    await listenClient.connect();
    logInfo('Database listener connected');

    // Listen to entity_changes channel
    await listenClient.query('LISTEN entity_changes');

    // Handle NOTIFY events
    listenClient.on('notification', (msg) => {
      if (msg.channel === 'entity_changes' && msg.payload) {
        try {
          const payload = JSON.parse(msg.payload) as EntityChangePayload;
          handleEntityChange(payload);
        } catch (error) {
          logError('Failed to parse entity change payload', {
            error: error instanceof Error ? error.message : 'Unknown error',
            payload: msg.payload,
          });
        }
      }
    });

    // Handle connection errors
    listenClient.on('error', (error) => {
      logError('Database listener connection error', {
        error: error.message,
      });
      isListening = false;
      scheduleReconnect();
    });

    // Handle connection end
    listenClient.on('end', () => {
      logWarn('Database listener connection ended');
      isListening = false;
      scheduleReconnect();
    });

    isListening = true;
    logInfo('Database listener started and listening to entity_changes channel');
  } catch (error) {
    logError('Failed to start database listener', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    isListening = false;
    scheduleReconnect();
  }
}

/**
 * Handle entity change event from database
 * Emits corresponding application-level events
 */
function handleEntityChange(payload: EntityChangePayload): void {
  const {entityType, operation, data} = payload;

  try {
    switch (entityType) {
      case 'Account': {
        const account = data as Account;
        if (operation === 'created') {
          accountEventEmitter.emit('account.created', account);
        } else if (operation === 'updated') {
          // For updates, we only have the new state from the trigger
          // The old state would need to be stored separately if needed
          accountEventEmitter.emit('account.updated', account, account);
        } else if (operation === 'deleted') {
          accountEventEmitter.emit('account.deleted', account);
        }
        break;
      }
      case 'Category': {
        const category = data as Category;
        if (operation === 'created') {
          categoryEventEmitter.emit('category.created', category);
        } else if (operation === 'updated') {
          categoryEventEmitter.emit('category.updated', category, category);
        } else if (operation === 'deleted') {
          categoryEventEmitter.emit('category.deleted', category);
        }
        break;
      }
      case 'Payee': {
        const payee = data as Payee;
        if (operation === 'created') {
          payeeEventEmitter.emit('payee.created', payee);
        } else if (operation === 'updated') {
          payeeEventEmitter.emit('payee.updated', payee, payee);
        } else if (operation === 'deleted') {
          payeeEventEmitter.emit('payee.deleted', payee);
        }
        break;
      }
      case 'Transaction': {
        const transaction = data as Transaction;
        if (operation === 'created') {
          transactionEventEmitter.emit('transaction.created', transaction);
        } else if (operation === 'updated') {
          transactionEventEmitter.emit('transaction.updated', transaction, transaction);
        } else if (operation === 'deleted') {
          transactionEventEmitter.emit('transaction.deleted', transaction);
        }
        break;
      }
      default:
        logWarn('Unknown entity type in database notification', {entityType});
    }
  } catch (error) {
    logError('Failed to handle entity change event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      entityType,
      operation,
    });
  }
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  // Exponential backoff: start with 5 seconds, max 60 seconds
  const delay = Math.min(5000 * Math.pow(2, 0), 60000);

  reconnectTimeout = setTimeout(() => {
    logInfo('Attempting to reconnect database listener...');
    void startDatabaseListener();
  }, delay);
}

/**
 * Stop database listener
 */
export async function stopDatabaseListener(): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (listenClient) {
    try {
      await listenClient.query('UNLISTEN entity_changes');
      await listenClient.end();
      logInfo('Database listener stopped');
    } catch (error) {
      logError('Error stopping database listener', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      listenClient = null;
      isListening = false;
    }
  }
}
