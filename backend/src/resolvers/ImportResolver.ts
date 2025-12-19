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

const streamPipeline = promisify(pipeline);

// File upload security constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const ALLOWED_EXTENSIONS = ['.pdf'];

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

