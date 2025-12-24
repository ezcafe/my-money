/**
 * Import Resolver
 * Handles PDF import and transaction matching operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError, ValidationError} from '../utils/errors';
import {parsePDF} from '../services/PDFParser';
import {promisify} from 'util';
import {pipeline} from 'stream';
import {createWriteStream} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {randomUUID} from 'crypto';
import type {PrismaClient} from '@prisma/client';

const streamPipeline = promisify(pipeline);

// File upload security constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CSV_FILE_SIZE = 50 * 1024 * 1024; // 50MB for CSV
const ALLOWED_MIME_TYPES = ['application/pdf'];
const ALLOWED_EXTENSIONS = ['.pdf'];
const ALLOWED_CSV_MIME_TYPES = ['text/csv', 'application/csv', 'text/plain'];
const ALLOWED_CSV_EXTENSIONS = ['.csv'];

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const basename = filename.split('/').pop()?.split('\\').pop() || filename;
  // Remove dangerous characters
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Limit length
  if (sanitized.length > 255) {
    return sanitized.substring(0, 255);
  }
  return sanitized;
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Upload PDF and parse transactions
 */
export async function uploadPDF(
  _: unknown,
  {
    file,
  }: {
    file: Promise<{
      filename: string;
      mimetype?: string;
      encoding?: string;
      createReadStream: () => NodeJS.ReadableStream;
    }>;
  },
  context: GraphQLContext,
): Promise<{
  success: boolean;
  importedCount: number;
  importedTransactions: Array<{
    id: string;
    rawDate: string;
    rawDescription: string;
    rawDebit: number | null;
    rawCredit: number | null;
    matched: boolean;
    transactionId: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}> {
  const fileData = await file;
  const {filename, mimetype, createReadStream: fileStream} = fileData;

  // Validate MIME type
  if (mimetype && !ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new ValidationError(`Invalid file type. Only PDF files are allowed. Received: ${mimetype}`);
  }

  // Validate file extension
  if (!validateFileExtension(filename)) {
    throw new ValidationError(`Invalid file extension. Only .pdf files are allowed.`);
  }

  // Sanitize filename to prevent path traversal
  const sanitizedFilename = sanitizeFilename(filename);
  const tempPath = join(tmpdir(), `${randomUUID()}-${sanitizedFilename}`);

  // Stream file with size limit
  let totalSize = 0;
  const writeStream = createWriteStream(tempPath);
  const readStream = fileStream();

  // Monitor file size during upload
  readStream.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE) {
      if ('destroy' in readStream && typeof readStream.destroy === 'function') {
        readStream.destroy();
      }
      writeStream.destroy();
      throw new ValidationError(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
  });

  try {
    await streamPipeline(readStream, writeStream);
  } catch (error) {
    // Clean up on error
    const {unlinkSync} = await import('fs');
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  // Read file buffer
  const {readFileSync} = await import('fs');
  const buffer = readFileSync(tempPath);

  // Parse PDF
  const parsedTransactions = await parsePDF(buffer);

  // Create imported transactions
  const importedTransactions = await Promise.all(
    parsedTransactions.map(async (parsed) => {
      const imported = await context.prisma.importedTransaction.create({
        data: {
          rawDate: parsed.date,
          rawDescription: parsed.description,
          rawDebit: parsed.debit ?? null,
          rawCredit: parsed.credit ?? null,
          matched: false,
          userId: context.userId,
        },
      });

      return imported;
    }),
  );

  // Clean up temp file
  const {unlinkSync} = await import('fs');
  try {
    unlinkSync(tempPath);
  } catch {
    // Ignore cleanup errors
  }

  return {
    success: true,
    importedCount: importedTransactions.length,
    importedTransactions,
  };
}

/**
 * Match imported transaction with existing transaction
 */
export async function matchImportedTransaction(
  _: unknown,
  {importedId, transactionId}: {importedId: string; transactionId: string},
  context: GraphQLContext,
): Promise<{
  id: string;
  rawDate: string;
  rawDescription: string;
  rawDebit: number | null;
  rawCredit: number | null;
  matched: boolean;
  transactionId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Verify imported transaction belongs to user
  const imported = await context.prisma.importedTransaction.findFirst({
    where: {
      id: importedId,
      userId: context.userId,
    },
  });

  if (!imported) {
    throw new NotFoundError('ImportedTransaction');
  }

  // Verify transaction belongs to user
  const transaction = await context.prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId: context.userId,
    },
  });

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  // Update imported transaction
  const updated = await context.prisma.importedTransaction.update({
    where: {id: importedId},
    data: {
      matched: true,
      transactionId,
    },
  });

  return updated;
}

/**
 * Parse CSV content into array of objects
 * Handles quoted fields and commas within quotes
 * @param csvContent - CSV file content as string
 * @returns Array of objects with keys from header row
 */
function parseCSV(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      continue; // Skip malformed rows
    }
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]?.trim() ?? ''] = values[j]?.trim() ?? '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 * @param line - CSV line string
 * @returns Array of field values
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField); // Add last field

  return fields;
}

/**
 * Validate CSV file extension
 */
function validateCSVFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_CSV_EXTENSIONS.includes(ext);
}

/**
 * Import CSV file and merge data
 * Supports accounts, categories, payees, transactions, recurringTransactions
 * Matches by ID: updates if exists, creates if not
 */
export async function importCSV(
  _: unknown,
  {
    file,
    entityType,
  }: {
    file: Promise<{
      filename: string;
      mimetype?: string;
      encoding?: string;
      createReadStream: () => NodeJS.ReadableStream;
    }>;
    entityType: string;
  },
  context: GraphQLContext,
): Promise<{
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
}> {
  const fileData = await file;
  const {filename, mimetype, createReadStream: fileStream} = fileData;

  // Validate entity type
  const validEntityTypes = ['accounts', 'categories', 'payees', 'transactions', 'recurringTransactions'];
  if (!validEntityTypes.includes(entityType)) {
    throw new ValidationError(`Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`);
  }

  // Validate MIME type (allow CSV and plain text)
  if (mimetype && !ALLOWED_CSV_MIME_TYPES.includes(mimetype)) {
    // Some browsers may send different MIME types, so we'll be lenient
    if (!mimetype.includes('csv') && !mimetype.includes('text')) {
      throw new ValidationError(`Invalid file type. Only CSV files are allowed. Received: ${mimetype}`);
    }
  }

  // Validate file extension
  if (!validateCSVFileExtension(filename)) {
    throw new ValidationError(`Invalid file extension. Only .csv files are allowed.`);
  }

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(filename);
  const tempPath = join(tmpdir(), `${randomUUID()}-${sanitizedFilename}`);

  // Stream file with size limit
  let totalSize = 0;
  const writeStream = createWriteStream(tempPath);
  const readStream = fileStream();

  // Monitor file size during upload
  readStream.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_CSV_FILE_SIZE) {
      if ('destroy' in readStream && typeof readStream.destroy === 'function') {
        readStream.destroy();
      }
      writeStream.destroy();
      throw new ValidationError(`File size exceeds maximum allowed size of ${MAX_CSV_FILE_SIZE / 1024 / 1024}MB`);
    }
  });

  try {
    await streamPipeline(readStream, writeStream);
  } catch (error) {
    // Clean up on error
    const {unlinkSync} = await import('fs');
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  // Read file content
  const {readFileSync} = await import('fs');
  const csvContent = readFileSync(tempPath, 'utf-8');

  // Parse CSV
  const rows = parseCSV(csvContent);

  // Clean up temp file
  const {unlinkSync} = await import('fs');
  try {
    unlinkSync(tempPath);
  } catch {
    // Ignore cleanup errors
  }

  // Process rows based on entity type
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  // Use transaction to ensure atomicity
  await context.prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        let wasUpdated = false;
        if (entityType === 'accounts') {
          if (row.id) {
            const existing = await tx.account.findFirst({where: {id: row.id, userId: context.userId}});
            wasUpdated = existing !== null;
          }
          await importAccount(row, tx, context.userId);
          if (wasUpdated) {
            updated++;
          } else {
            created++;
          }
        } else if (entityType === 'categories') {
          if (row.id) {
            const existing = await tx.category.findFirst({where: {id: row.id, userId: context.userId || null}});
            wasUpdated = existing !== null;
          }
          await importCategory(row, tx, context.userId);
          if (wasUpdated) {
            updated++;
          } else {
            created++;
          }
        } else if (entityType === 'payees') {
          if (row.id) {
            const existing = await tx.payee.findFirst({where: {id: row.id, userId: context.userId || null}});
            wasUpdated = existing !== null;
          }
          await importPayee(row, tx, context.userId);
          if (wasUpdated) {
            updated++;
          } else {
            created++;
          }
        } else if (entityType === 'transactions') {
          if (row.id) {
            const existing = await tx.transaction.findFirst({where: {id: row.id, userId: context.userId}});
            wasUpdated = existing !== null;
          }
          await importTransaction(row, tx, context.userId);
          if (wasUpdated) {
            updated++;
          } else {
            created++;
          }
        } else if (entityType === 'recurringTransactions') {
          if (row.id) {
            const existing = await tx.recurringTransaction.findFirst({where: {id: row.id, userId: context.userId}});
            wasUpdated = existing !== null;
          }
          await importRecurringTransaction(row, tx, context.userId);
          if (wasUpdated) {
            updated++;
          } else {
            created++;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }
  });

  return {
    success: errors.length === 0,
    created,
    updated,
    errors,
  };
}

/**
 * Import account from CSV row
 */
async function importAccount(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
): Promise<void> {
  if (!row.name) {
    throw new ValidationError('Account name is required');
  }

  const data = {
    name: row.name,
    initBalance: row.initBalance ? parseFloat(row.initBalance) : 0,
    isDefault: row.isDefault === 'true' || row.isDefault === '1',
    userId,
  };

  if (row.id) {
    // Check if account exists and belongs to user
    const existing = await tx.account.findFirst({
      where: {id: row.id, userId},
    });
    if (existing) {
      await tx.account.update({
        where: {id: row.id},
        data,
      });
      return;
    }
  }

  // Create new account
  await tx.account.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

/**
 * Import category from CSV row
 */
async function importCategory(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
): Promise<void> {
  if (!row.name) {
    throw new ValidationError('Category name is required');
  }

  const data = {
    name: row.name,
    isDefault: row.isDefault === 'true' || row.isDefault === '1',
    userId,
  };

  if (row.id) {
    const existing = await tx.category.findFirst({
      where: {id: row.id, userId: userId || null},
    });
    if (existing) {
      await tx.category.update({
        where: {id: row.id},
        data,
      });
      return;
    }
  }

  await tx.category.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

/**
 * Import payee from CSV row
 */
async function importPayee(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
): Promise<void> {
  if (!row.name) {
    throw new ValidationError('Payee name is required');
  }

  const data = {
    name: row.name,
    isDefault: row.isDefault === 'true' || row.isDefault === '1',
    userId,
  };

  if (row.id) {
    const existing = await tx.payee.findFirst({
      where: {id: row.id, userId: userId || null},
    });
    if (existing) {
      await tx.payee.update({
        where: {id: row.id},
        data,
      });
      return;
    }
  }

  await tx.payee.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

/**
 * Import transaction from CSV row
 */
async function importTransaction(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
): Promise<void> {
  if (!row.value || !row.accountId || !row.date) {
    throw new ValidationError('Transaction value, accountId, and date are required');
  }

  // Validate account exists and belongs to user
  const account = await tx.account.findFirst({
    where: {id: row.accountId, userId},
  });
  if (!account) {
    throw new ValidationError(`Account with ID ${row.accountId} not found`);
  }

  // Validate category if provided
  if (row.categoryId) {
    const category = await tx.category.findFirst({
      where: {id: row.categoryId, userId: userId || null},
    });
    if (!category) {
      throw new ValidationError(`Category with ID ${row.categoryId} not found`);
    }
  }

  // Validate payee if provided
  if (row.payeeId) {
    const payee = await tx.payee.findFirst({
      where: {id: row.payeeId, userId: userId || null},
    });
    if (!payee) {
      throw new ValidationError(`Payee with ID ${row.payeeId} not found`);
    }
  }

  const data = {
    value: parseFloat(row.value),
    date: new Date(row.date),
    accountId: row.accountId,
    categoryId: row.categoryId || null,
    payeeId: row.payeeId || null,
    note: row.note || null,
    userId,
  };

  if (row.id) {
    const existing = await tx.transaction.findFirst({
      where: {id: row.id, userId},
    });
    if (existing) {
      await tx.transaction.update({
        where: {id: row.id},
        data,
      });
      return;
    }
  }

  await tx.transaction.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

/**
 * Import recurring transaction from CSV row
 */
async function importRecurringTransaction(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
): Promise<void> {
  if (!row.cronExpression || !row.value || !row.accountId || !row.nextRunDate) {
    throw new ValidationError('Recurring transaction cronExpression, value, accountId, and nextRunDate are required');
  }

  // Validate account exists and belongs to user
  const account = await tx.account.findFirst({
    where: {id: row.accountId, userId},
  });
  if (!account) {
    throw new ValidationError(`Account with ID ${row.accountId} not found`);
  }

  // Validate category if provided
  if (row.categoryId) {
    const category = await tx.category.findFirst({
      where: {id: row.categoryId, userId: userId || null},
    });
    if (!category) {
      throw new ValidationError(`Category with ID ${row.categoryId} not found`);
    }
  }

  // Validate payee if provided
  if (row.payeeId) {
    const payee = await tx.payee.findFirst({
      where: {id: row.payeeId, userId: userId || null},
    });
    if (!payee) {
      throw new ValidationError(`Payee with ID ${row.payeeId} not found`);
    }
  }

  const data = {
    cronExpression: row.cronExpression,
    value: parseFloat(row.value),
    accountId: row.accountId,
    categoryId: row.categoryId || null,
    payeeId: row.payeeId || null,
    note: row.note || null,
    nextRunDate: new Date(row.nextRunDate),
    userId,
  };

  if (row.id) {
    const existing = await tx.recurringTransaction.findFirst({
      where: {id: row.id, userId},
    });
    if (existing) {
      await tx.recurringTransaction.update({
        where: {id: row.id},
        data,
      });
      return;
    }
  }

  await tx.recurringTransaction.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

