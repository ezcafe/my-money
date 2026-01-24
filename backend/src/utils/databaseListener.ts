/**
 * Database Listener
 * Listens for PostgreSQL NOTIFY events and emits application-level events
 * This provides comprehensive event coverage even for changes made outside the application
 */

import { Client } from 'pg';
import { logInfo, logWarn, logError } from './logger';
import {
  accountEventEmitter,
  categoryEventEmitter,
  payeeEventEmitter,
  transactionEventEmitter,
} from '../events';
import type { Account, Category, Payee, Transaction } from '@prisma/client';
import { adjustDatabaseConnectionString } from '../config';

/**
 * Safely convert an unknown error to a string message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    // Try to get a meaningful string representation
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    // Try JSON.stringify for objects (but avoid circular references)
    try {
      const json = JSON.stringify(error);
      if (json !== '{}' && json !== '[]') {
        return json;
      }
    } catch {
      // JSON.stringify failed (circular reference or other issue)
      // Fall through to default
    }
  }
  return 'Unknown error';
}

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

  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Adjust connection string hostname based on environment
  databaseUrl = adjustDatabaseConnectionString(databaseUrl);

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
            error: error instanceof Error ? error.message : String(error),
            payload: msg.payload,
          });
        }
      }
    });

    // Handle connection errors
    listenClient.on('error', (error: unknown) => {
      const errorMessage = getErrorMessage(error);
      const isConnectionError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('connect');

      if (isConnectionError && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        logWarn(
          'Database listener: Connection error (expected during startup). The database may still be initializing. Automatic reconnection will continue.',
          {
            event: 'database_listener_connection_error_expected',
            attempt: reconnectAttempts + 1,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            error: errorMessage,
            explanation:
              'This is normal during application startup when the database is still starting up or not yet ready to accept LISTEN/NOTIFY connections.',
            whenWillSucceed:
              'Connection will succeed once the database is fully initialized and ready to accept connections. The listener will automatically retry with exponential backoff (5s, 10s, 20s, 40s, up to 60s).',
            howToVerify:
              'Once connected, you will see a log message: "Database listener started and listening to entity_changes channel". You can also verify by checking that database triggers are firing and NOTIFY events are being received.',
          }
        );
      } else {
        logError('Database listener connection error', {
          error: errorMessage,
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
        });
      }
      isListening = false;
      // Clean up the failed client
      if (listenClient) {
        listenClient.removeAllListeners();
        listenClient.end().catch(() => {
          // Ignore errors during cleanup
        });
        listenClient = null;
      }
      scheduleReconnect();
    });

    // Handle connection end
    listenClient.on('end', () => {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        logWarn(
          'Database listener: Connection closed (expected during startup). Will attempt to reconnect automatically.',
          {
            event: 'database_listener_connection_ended_expected',
            attempt: reconnectAttempts + 1,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            explanation:
              'This is normal during application startup when the database connection is not yet established.',
            whenWillSucceed:
              'Connection will succeed once the database is fully ready. The listener will automatically retry with exponential backoff.',
            howToVerify:
              'Once connected, you will see: "Database listener started and listening to entity_changes channel".',
          }
        );
      } else {
        logWarn('Database listener connection ended');
      }
      isListening = false;
      if (listenClient) {
        listenClient.removeAllListeners();
        listenClient = null;
      }
      scheduleReconnect();
    });

    isListening = true;
    reconnectAttempts = 0; // Reset on successful connection
    logInfo(
      'Database listener started and listening to entity_changes channel',
      {
        event: 'database_listener_connected',
        channel: 'entity_changes',
        status: 'connected',
        howToVerify:
          'The listener is now ready to receive NOTIFY events from database triggers. You can verify it is working by creating/updating/deleting entities (Account, Category, Payee, Transaction) and checking that corresponding application events are emitted.',
      }
    );
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const isConnectionError =
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('connect');

    if (isConnectionError && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      logWarn(
        'Database listener: Unable to connect to database (expected during startup). Automatic reconnection will continue.',
        {
          event: 'database_listener_startup_connection_error_expected',
          attempt: reconnectAttempts + 1,
          maxAttempts: MAX_RECONNECT_ATTEMPTS,
          error: errorMessage,
          explanation:
            'This is normal during application startup when the database is still initializing or not yet ready to accept LISTEN/NOTIFY connections.',
          whenWillSucceed:
            'Connection will succeed once the database is fully initialized and ready. The listener will automatically retry with exponential backoff (5s, 10s, 20s, 40s, up to 60s) for up to 10 attempts.',
          howToVerify:
            'Once connected successfully, you will see a log message: "Database listener started and listening to entity_changes channel". The listener will then be ready to receive real-time database change notifications via PostgreSQL NOTIFY events.',
        }
      );
    } else {
      const errorStack = error instanceof Error ? error.stack : undefined;
      logError(
        'Failed to start database listener',
        {
          error: errorMessage,
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
          stack: errorStack,
        },
        error instanceof Error ? error : new Error(errorMessage)
      );
    }
    isListening = false;
    // Clean up the failed client
    if (listenClient) {
      try {
        listenClient.removeAllListeners();
        listenClient.end().catch(() => {
          // Ignore errors during cleanup
        });
      } catch {
        // Ignore cleanup errors
      }
      listenClient = null;
    }
    scheduleReconnect();
  }
}

/**
 * Handle entity change event from database
 * Emits corresponding application-level events
 */
function handleEntityChange(payload: EntityChangePayload): void {
  const { entityType, operation, data } = payload;

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
          transactionEventEmitter.emit(
            'transaction.updated',
            transaction,
            transaction
          );
        } else if (operation === 'deleted') {
          transactionEventEmitter.emit('transaction.deleted', transaction);
        }
        break;
      }
      default:
        logWarn('Unknown entity type in database notification', { entityType });
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
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function scheduleReconnect(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  reconnectAttempts++;

  // Stop reconnecting after max attempts to avoid infinite loops
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    logWarn(
      'Database listener: Max reconnection attempts reached. Stopping reconnection attempts.',
      {
        attempts: reconnectAttempts,
      }
    );
    return;
  }

  // Exponential backoff: start with 5 seconds, max 60 seconds
  const baseDelay = 5000;
  const delay = Math.min(
    baseDelay * Math.pow(2, Math.min(reconnectAttempts - 1, 3)),
    60000
  );

  reconnectTimeout = setTimeout(() => {
    logInfo('Database listener: Attempting to reconnect...', {
      event: 'database_listener_reconnect_attempt',
      attempt: reconnectAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      nextRetryIn: `${Math.round(delay / 1000)}s`,
      explanation:
        'This is expected during startup. The listener will continue retrying until the database is ready.',
    });
    void startDatabaseListener().catch((error: unknown) => {
      const errorMessage = getErrorMessage(error);
      const isConnectionError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('connect');

      if (isConnectionError && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        // Don't log as error for connection issues during startup
        logWarn(
          'Database listener: Reconnection attempt failed (expected during startup). Will retry automatically.',
          {
            event: 'database_listener_reconnect_failed_expected',
            attempt: reconnectAttempts,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            error: errorMessage,
            explanation:
              'This is normal during startup. The database may still be initializing.',
            whenWillSucceed:
              'Connection will succeed once the database is fully ready. Retries will continue with exponential backoff.',
            howToVerify:
              'Once connected, you will see: "Database listener started and listening to entity_changes channel".',
          }
        );
      } else {
        logError(
          'Database listener reconnection failed',
          {
            error: errorMessage,
            attempt: reconnectAttempts,
          },
          error instanceof Error ? error : new Error(errorMessage)
        );
      }
    });
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

  reconnectAttempts = 0; // Reset attempts when manually stopped

  if (listenClient) {
    try {
      await listenClient.query('UNLISTEN entity_changes');
      await listenClient.end();
      logInfo('Database listener stopped');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      logError(
        'Error stopping database listener',
        {
          error: errorMessage,
        },
        error instanceof Error ? error : new Error(errorMessage)
      );
    } finally {
      listenClient?.removeAllListeners();
      listenClient = null;
      isListening = false;
    }
  }
}
