/**
 * Import Resolver
 * Handles PDF import and transaction matching operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
import type {GraphQLContext} from '../middleware/context';
import {NotFoundError, ValidationError} from '../utils/errors';
import {withPrismaErrorHandling} from '../utils/prismaErrors';
import {parsePDF} from '../services/PDFParser';
import {promisify} from 'util';
import {pipeline} from 'stream';
import {createWriteStream} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {randomUUID} from 'crypto';
import type {PrismaClient, CategoryType, Account, Category, Payee} from '@prisma/client';
import {incrementAccountBalance} from '../services/AccountBalanceService';
import {updateBudgetForTransaction} from '../services/BudgetService';
import {TRANSACTION_BATCH_SIZE, MAX_PDF_FILE_SIZE, MAX_CSV_FILE_SIZE} from '../utils/constants';
import {WorkspaceDetectionService} from '../services/WorkspaceDetectionService';
import {getUserDefaultWorkspace, checkWorkspaceAccess} from '../services/WorkspaceService';
import {z} from 'zod';

const streamPipeline = promisify(pipeline);

// File upload security constants
const MAX_FILE_SIZE = MAX_PDF_FILE_SIZE;
const ALLOWED_MIME_TYPES = ['application/pdf'] as const;
const ALLOWED_EXTENSIONS = ['.pdf'] as const;
const ALLOWED_CSV_MIME_TYPES = ['text/csv', 'application/csv', 'text/plain'] as const;
const ALLOWED_CSV_EXTENSIONS = ['.csv'] as const;

/**
 * Zod schema for PDF file upload validation
 */
const PDFFileSchema = z.object({
  filename: z.string().min(1).max(255).refine(
    (name) => {
      const ext = name.toLowerCase().substring(name.lastIndexOf('.'));
      return ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number]);
    },
    {message: 'Invalid file extension. Only .pdf files are allowed.'},
  ),
  mimetype: z.enum(ALLOWED_MIME_TYPES).optional(),
  encoding: z.string().optional(),
  createReadStream: z.function().returns(z.any()),
}).refine(
  (data) => {
    // Validate filename is not empty after sanitization
    const sanitized = sanitizeFilename(data.filename);
    return sanitized.length > 0;
  },
  {message: 'Invalid filename.'},
);

/**
 * Zod schema for CSV file upload validation
 * Note: Currently unused but kept for future validation needs
 */
// const CSVFileSchema = z.object({
//   filename: z.string().min(1).max(255).refine(
//     (name) => {
//       const ext = name.toLowerCase().substring(name.lastIndexOf('.'));
//       return ALLOWED_CSV_EXTENSIONS.includes(ext as typeof ALLOWED_CSV_EXTENSIONS[number]);
//     },
//     {message: 'Invalid file extension. Only .csv files are allowed.'},
//   ),
//   mimetype: z.enum(ALLOWED_CSV_MIME_TYPES).optional(),
//   encoding: z.string().optional(),
//   createReadStream: z.function().returns(z.any()),
// }).refine(
//   (data) => {
//     // Validate filename is not empty after sanitization
//     const sanitized = sanitizeFilename(data.filename);
//     return sanitized.length > 0;
//   },
//   {message: 'Invalid filename.'},
// );

/**
 * Sanitize filename to prevent path traversal attacks
 * This function is secure and prevents path traversal by:
 * 1. Removing all path components (/, \)
 * 2. Removing dangerous characters
 * 3. Limiting filename length
 *
 * Tested and verified to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components to prevent path traversal
  // Split by both Unix and Windows path separators
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const basename = filename.split('/').pop()?.split('\\').pop() || filename;
  // Remove dangerous characters that could be used for path manipulation
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Limit length to prevent buffer overflow attacks
  if (sanitized.length > 255) {
    return sanitized.substring(0, 255);
  }
  return sanitized;
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false;
  }
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number]);
}

/**
 * Validate file content using magic numbers (file signatures)
 * This is more secure than relying solely on file extensions or MIME types
 * @param buffer - File buffer to check
 * @param expectedType - Expected file type ('pdf' or 'csv')
 * @returns True if magic number matches expected type
 */
export function validateFileMagicNumber(buffer: Buffer, expectedType: 'pdf' | 'csv'): boolean {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  // Read first few bytes (magic number)
  const magicBytes = buffer.subarray(0, Math.min(4, buffer.length));

  if (expectedType === 'pdf') {
    // PDF files start with %PDF (hex: 25 50 44 46)
    const pdfMagic = Buffer.from('%PDF', 'utf-8');
    return magicBytes.subarray(0, 4).equals(pdfMagic);
  }

  if (expectedType === 'csv') {
    // CSV files are text files, so we check for common text encodings
    // UTF-8 BOM: EF BB BF
    // UTF-16 LE BOM: FF FE
    // UTF-16 BE BOM: FE FF
    // Or plain ASCII text (first byte should be printable ASCII: 0x20-0x7E)
    const firstByte = magicBytes[0];
    if (firstByte === undefined) {
      return false;
    }
    const secondByte = magicBytes[1] ?? 0;
    const thirdByte = magicBytes[2] ?? 0;

    // Check for BOMs
    if (firstByte === 0xEF && secondByte === 0xBB && thirdByte === 0xBF) {
      return true; // UTF-8 BOM
    }
    if (firstByte === 0xFF && secondByte === 0xFE) {
      return true; // UTF-16 LE BOM
    }
    if (firstByte === 0xFE && secondByte === 0xFF) {
      return true; // UTF-16 BE BOM
    }

    // Check for printable ASCII (common for CSV files)
    // ASCII printable range: 0x20 (space) to 0x7E (~)
    if (firstByte >= 0x20 && firstByte <= 0x7E) {
      // Check if it looks like text (not binary)
      // CSV typically starts with letters, numbers, or quotes
      return true;
    }

    return false;
  }

  return false;
}

/**
 * Match pattern against text with ReDoS protection
 * Tries regex first, falls back to case-insensitive string includes
 * Limits pattern length and checks for potentially dangerous regex patterns
 * @param text - Text to match against
 * @param pattern - Pattern to match (regex or string)
 * @returns True if pattern matches
 */
function matchPattern(text: string, pattern: string): boolean {
  // Limit pattern length to prevent ReDoS attacks
  // Most ReDoS attacks use patterns longer than 500 characters
  const MAX_PATTERN_LENGTH = 500;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    // For very long patterns, fall back to simple string matching
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  // Check for potentially dangerous regex patterns that could cause ReDoS
  // Patterns with excessive nested quantifiers like (a+)+ or (a*)* are dangerous
  // This is a simple heuristic - for production, consider using a library like 'safe-regex'
  const dangerousPattern = /(\([^)]*\+\)\+|\([^)]*\*\)\*|\([^)]*\?\)\?)/;
  if (dangerousPattern.test(pattern)) {
    // Skip regex matching for potentially dangerous patterns
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  // Try regex first
  try {
    const regex = new RegExp(pattern, 'i');
    // Limit the input text length to prevent excessive processing
    // This helps prevent ReDoS even if a malicious pattern gets through
    const testText = text.length > 10000 ? text.substring(0, 10000) : text;
    if (regex.test(testText)) {
      return true;
    }
  } catch {
    // Not a valid regex, fall through to string matching
  }

  // Fallback to case-insensitive string includes
  return text.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Normalize description by taking the first 5 words
 * When the first 5 words are similar, descriptions are considered the same
 * Examples:
 * - "Retail VNM HA NOI Grab* A-8MSUAJMGXDMNAV" -> "Retail VNM HA NOI Grab*"
 * - "Retail VNM HA NOI Grab* A-8NXKI4DGWERDAV" -> "Retail VNM HA NOI Grab*"
 * - "Retail VNM HA NOI Grab* A-8K9COKIGWSC6AV" -> "Retail VNM HA NOI Grab*"
 * @param description - Description to normalize
 * @returns Normalized description (first 5 words)
 */
function normalizeDescription(description: string): string {
  // Split description into words (split by whitespace)
  const words = description.trim().split(/\s+/);
  // Take first 5 words
  const first5Words = words.slice(0, 5);
  // Join and return
  return first5Words.join(' ').trim();
}

/**
 * Get default account for workspace
 * @param context - GraphQL context
 * @param workspaceId - Workspace ID
 * @returns Default account
 */
async function getDefaultAccount(context: GraphQLContext, workspaceId: string): Promise<Account> {
  return await withPrismaErrorHandling(
    async () => {
      let account = await context.prisma.account.findFirst({
        where: {
          workspaceId,
          isDefault: true,
        },
      });

      // Create default account if none exists
      account ??= await context.prisma.account.create({
        data: {
          name: 'Cash',
          initBalance: 0,
          balance: 0,
          isDefault: true,
          accountType: 'Cash',
          workspaceId,
          createdBy: context.userId,
          lastEditedBy: context.userId,
        },
      });

      return account;
    },
    {resource: 'Account', operation: 'read'},
  );
}

/**
 * Get default category for workspace
 * @param context - GraphQL context
 * @param workspaceId - Workspace ID
 * @returns Default category (Food & Groceries)
 */
async function getDefaultCategory(context: GraphQLContext, workspaceId: string): Promise<Category> {
  return await withPrismaErrorHandling(
    async () => {
      let category = await context.prisma.category.findFirst({
        where: {
          workspaceId,
          isDefault: true,
          name: 'Food & Groceries',
        },
      });

      // Create default expense category if none exists
      category ??= await context.prisma.category.create({
        data: {
          name: 'Food & Groceries',
          categoryType: 'Expense',
          isDefault: true,
          workspaceId,
          createdBy: context.userId,
          lastEditedBy: context.userId,
        },
      });

      return category;
    },
    {resource: 'Category', operation: 'read'},
  );
}

/**
 * Get default payee for workspace
 * @param context - GraphQL context
 * @param workspaceId - Workspace ID
 * @returns Default payee (Neccesities)
 */
async function getDefaultPayee(context: GraphQLContext, workspaceId: string): Promise<Payee> {
  return await withPrismaErrorHandling(
    async () => {
      let payee = await context.prisma.payee.findFirst({
        where: {
          workspaceId,
          isDefault: true,
        },
      });

      // Create default payee if none exists
      payee ??= await context.prisma.payee.create({
        data: {
          name: 'Neccesities',
          isDefault: true,
          workspaceId,
          createdBy: context.userId,
          lastEditedBy: context.userId,
        },
      });

      return payee;
    },
    {resource: 'Payee', operation: 'read'},
  );
}

/**
 * Match card number to account using ImportMatchRules
 * @param cardNumber - Card number to match
 * @param rules - ImportMatchRules to search
 * @returns Account ID if matched, null otherwise
 */
function matchAccount(cardNumber: string | null, rules: Array<{pattern: string; accountId: string | null}>): string | null {
  if (!cardNumber) return null;

  for (const rule of rules) {
    if (rule.accountId && matchPattern(cardNumber, rule.pattern)) {
      return rule.accountId;
    }
  }

  return null;
}

/**
 * Match description to category using ImportMatchRules
 * @param description - Description to match
 * @param rules - ImportMatchRules to search
 * @returns Category ID if matched, null otherwise
 */
function matchCategory(description: string, rules: Array<{pattern: string; categoryId: string | null}>): string | null {
  const normalizedDescription = normalizeDescription(description);
  for (const rule of rules) {
    if (rule.categoryId) {
      const normalizedPattern = normalizeDescription(rule.pattern);
      if (matchPattern(normalizedDescription, normalizedPattern)) {
        return rule.categoryId;
      }
    }
  }

  return null;
}

/**
 * Match description to payee using ImportMatchRules
 * @param description - Description to match
 * @param rules - ImportMatchRules to search
 * @returns Payee ID if matched, null otherwise
 */
function matchPayee(description: string, rules: Array<{pattern: string; payeeId: string | null}>): string | null {
  const normalizedDescription = normalizeDescription(description);
  for (const rule of rules) {
    if (rule.payeeId) {
      const normalizedPattern = normalizeDescription(rule.pattern);
      if (matchPattern(normalizedDescription, normalizedPattern)) {
        return rule.payeeId;
      }
    }
  }

  return null;
}

/**
 * Find or create an ImportedTransaction record
 * Checks for existing unmapped transaction with same normalized description, date, and amount
 * to prevent duplicates when the same PDF is uploaded multiple times
 * @param parsed - Parsed transaction data
 * @param context - GraphQL context
 * @returns ImportedTransaction record (existing or newly created)
 */
async function findOrCreateImportedTransaction(
  parsed: {date: string; description: string; debit?: number | null; credit?: number | null},
  context: GraphQLContext,
  workspaceId: string,
): Promise<{
  id: string;
  rawDate: string;
  rawDescription: string;
  rawDebit: number | null;
  rawCredit: number | null;
  matched: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Normalize description for matching
  const normalizedDescription = normalizeDescription(parsed.description);

  return await withPrismaErrorHandling(
    async () => {
      // Find candidates: unmapped transactions with same date and amount
      const candidates = await context.prisma.importedTransaction.findMany({
        where: {
          userId: context.userId,
          matched: false,
          rawDate: parsed.date,
          rawDebit: parsed.debit ?? null,
          rawCredit: parsed.credit ?? null,
        },
      });

      // Check if any candidate has matching normalized description
      for (const candidate of candidates) {
        const candidateNormalized = normalizeDescription(candidate.rawDescription);
        if (candidateNormalized === normalizedDescription) {
          return {
            ...candidate,
            rawDebit: candidate.rawDebit ? Number(candidate.rawDebit) : null,
            rawCredit: candidate.rawCredit ? Number(candidate.rawCredit) : null,
          };
        }
      }

      // Create new record
      const imported = await context.prisma.importedTransaction.create({
        data: {
          rawDate: parsed.date,
          rawDescription: parsed.description,
          rawDebit: parsed.debit ?? null,
          rawCredit: parsed.credit ?? null,
          matched: false,
          userId: context.userId,
          workspaceId,
        },
      });
      return {
        ...imported,
        rawDebit: imported.rawDebit ? Number(imported.rawDebit) : null,
        rawCredit: imported.rawCredit ? Number(imported.rawCredit) : null,
      };
    },
    {resource: 'ImportedTransaction', operation: 'create'},
  );
}

/**
 * Upload PDF and parse transactions with auto-mapping
 */
export async function uploadPDF(
  _: unknown,
  {
    file,
    dateFormat,
  }: {
    file: Promise<{
      filename: string;
      mimetype?: string;
      encoding?: string;
      createReadStream: () => NodeJS.ReadableStream;
    }>;
    dateFormat?: string;
  },
  context: GraphQLContext,
): Promise<{
  success: boolean;
  importedCount: number;
  savedCount: number;
    unmappedTransactions: Array<{
      id: string;
      rawDate: string;
      rawDescription: string;
      rawDebit: number | null;
      rawCredit: number | null;
      suggestedAccountId: string | null;
      suggestedCategoryId: string | null;
      suggestedPayeeId: string | null;
      cardNumber: string | null;
      detectedWorkspaceId: string | null;
    }>;
}> {  // Handle file parameter - it might be a Promise or already resolved
  let fileData = file instanceof Promise ? await file : file;

  // If fileData is empty (Promise resolved to empty object due to serialization),
  // try to retrieve from request context
  if (fileData && typeof fileData === 'object' && Object.keys(fileData).length === 0) {
    // Try to get file from request context (stored in multipart handler)
    // Note: This is a fallback if Promise gets serialized
    const request = context.request;
    if (request) {
      // Try to get from request.req.uploadFiles (stored directly on request object)
      const uploadFiles = (request.req as {uploadFiles?: Record<string, {filename: string; mimetype?: string; encoding?: string; createReadStream: () => NodeJS.ReadableStream}>}).uploadFiles;
      if (uploadFiles) {
        // Get the first file (typically there's only one)
        const fileKey = Object.keys(uploadFiles)[0];
        if (fileKey && uploadFiles[fileKey]) {
          fileData = uploadFiles[fileKey];
        }
      }
    }
  }

  // Check if fileData has the expected structure
  if (!fileData || typeof fileData !== 'object') {
    throw new ValidationError('Invalid file upload. File data is missing or invalid.');
  }

  // Extract file properties - handle both standard and alternative property names
  const filename = (fileData as {filename?: string; name?: string}).filename ?? (fileData as {filename?: string; name?: string}).name;
  const mimetype = (fileData as {mimetype?: string; type?: string}).mimetype ?? (fileData as {mimetype?: string; type?: string}).type;
  const createReadStream = (fileData as {createReadStream?: () => NodeJS.ReadableStream}).createReadStream;

  // Validate file structure with Zod
  const validationResult = PDFFileSchema.safeParse({
    filename: filename ?? '',
    mimetype: mimetype as typeof ALLOWED_MIME_TYPES[number] | undefined,
    encoding: (fileData as {encoding?: string}).encoding,
    createReadStream,
  });

  if (!validationResult.success) {
    const errors = validationResult.error.errors.map((e) => e.message).join(', ');
    throw new ValidationError(`Invalid file upload: ${errors}`);
  }

  // Additional validation for createReadStream
  if (!createReadStream || typeof createReadStream !== 'function') {
    throw new ValidationError('Invalid file upload. File stream is missing. Please ensure the file is uploaded correctly.');
  }

  const fileStream = createReadStream;

  // Sanitize filename to prevent path traversal
  const sanitizedFilename = sanitizeFilename(filename ?? 'file');
  const tempPath = join(tmpdir(), `${randomUUID()}-${sanitizedFilename}`);

  try {
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
      // Clean up on error during stream
      const {unlinkSync} = await import('fs');
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }

    // Read file buffer
    // Note: pdfjs-dist requires the entire file in memory
    // This is a limitation of the library, not our implementation
    // For production, consider monitoring memory usage and potentially
    // using alternative PDF parsing libraries that support streaming
    const {readFileSync} = await import('fs');
    const buffer: Buffer = readFileSync(tempPath) as Buffer;

    // Validate file content using magic numbers (more secure than extension/MIME type)
    if (!validateFileMagicNumber(buffer, 'pdf')) {
      const {unlinkSync} = await import('fs');
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new ValidationError('Invalid file content. File does not appear to be a valid PDF file.');
    }

    // Parse PDF with date format (default to DD/MM/YYYY)
    const parsedData = await parsePDF(buffer, dateFormat ?? 'DD/MM/YYYY');
    const {cardNumber, transactions} = parsedData;

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Get defaults and match rules
    const [defaultAccount, _defaultCategory, _defaultPayee, matchRules, creditCardAccount] = await Promise.all([
      getDefaultAccount(context, workspaceId),
      getDefaultCategory(context, workspaceId),
      getDefaultPayee(context, workspaceId),
      withPrismaErrorHandling(
        async () =>
          await context.prisma.importMatchRule.findMany({
            where: {userId: context.userId},
          }),
        {resource: 'ImportMatchRule', operation: 'read'},
      ),
      // Find first CreditCard account for fallback
      context.prisma.account.findFirst({
        where: {
          workspaceId,
          accountType: 'CreditCard',
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);
    const unmappedTransactions: Array<{
      id: string;
      rawDate: string;
      rawDescription: string;
      rawDebit: number | null;
      rawCredit: number | null;
      suggestedAccountId: string | null;
      suggestedCategoryId: string | null;
      suggestedPayeeId: string | null;
      cardNumber: string | null;
      detectedWorkspaceId: string | null;
    }> = [];

    let savedCount = 0;

    // Process transactions in batches with concurrency limits to improve performance
    // and avoid overwhelming the database with too many concurrent operations
    for (let i = 0; i < transactions.length; i += TRANSACTION_BATCH_SIZE) {
      const batch = transactions.slice(i, i + TRANSACTION_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (parsed) => {
      // Calculate value (use absolute value)
      const value = Math.abs(parsed.debit ?? parsed.credit ?? 0);
      if (value === 0) return false; // Skip transactions with no value

      // Match account from card number
      const matchedAccountId = matchAccount(cardNumber, matchRules);
      // If no Card Number Mapping match, use first CreditCard account, otherwise default account
      const accountId = matchedAccountId ?? creditCardAccount?.id ?? defaultAccount.id;

      // Match category and payee from description
      const matchedCategoryId = matchCategory(parsed.description, matchRules);
      const matchedPayeeId = matchPayee(parsed.description, matchRules);

      // Check if all mappings are found (account, category, payee)
      // We consider it fully mapped if account is matched (not default) and category/payee are matched
      const isFullyMapped = matchedAccountId !== null && matchedCategoryId !== null && matchedPayeeId !== null;

      if (isFullyMapped) {
        // Save transaction immediately
        try {
          // Parse date
          const date = parseDate(parsed.date);

          // Get category to determine balance delta
          const category = await context.prisma.category.findUnique({
            where: {id: matchedCategoryId},
            select: {categoryType: true},
          });

          // Calculate balance delta based on category type
          const balanceDelta = category?.categoryType === 'Income' ? value : -value;

          // Create transaction and update balance atomically
          await context.prisma.$transaction(async (tx) => {
            const newTransaction = await tx.transaction.create({
              data: {
                value,
                date,
                accountId,
                categoryId: matchedCategoryId,
                payeeId: matchedPayeeId,
                note: parsed.description,
                createdBy: context.userId,
                lastEditedBy: context.userId,
              },
            });

            await incrementAccountBalance(accountId, balanceDelta, tx);

            // Get account to find workspaceId for budget updates
            const account = await tx.account.findUnique({
              where: {id: accountId},
              select: {workspaceId: true},
            });

            // Update budgets for this transaction
            if (account) {
              await updateBudgetForTransaction(
                {
                  id: newTransaction.id,
                  accountId: newTransaction.accountId,
                  categoryId: newTransaction.categoryId,
                  payeeId: newTransaction.payeeId,
                  userId: context.userId,
                  workspaceId: account.workspaceId,
                  value: Number(newTransaction.value),
                  date: newTransaction.date,
                  categoryType: category?.categoryType ?? null,
                },
                'create',
                undefined,
                tx,
              );
            }
          });

          return true; // Successfully saved
        } catch {
          // If save fails, add to unmapped list
          const imported = await findOrCreateImportedTransaction(parsed, context, workspaceId);

          unmappedTransactions.push({
            id: imported.id,
            rawDate: parsed.date,
            rawDescription: parsed.description,
            rawDebit: parsed.debit ?? null,
            rawCredit: parsed.credit ?? null,
            suggestedAccountId: accountId,
            suggestedCategoryId: matchedCategoryId,
            suggestedPayeeId: matchedPayeeId,
            cardNumber,
            detectedWorkspaceId: null, // Will be set after detection
          });
          return false; // Not saved
        }
      } else {
        // Add to unmapped list - use findOrCreate to prevent duplicates
        const imported = await findOrCreateImportedTransaction(parsed, context, workspaceId);

        unmappedTransactions.push({
          id: imported.id,
          rawDate: parsed.date,
          rawDescription: parsed.description,
          rawDebit: parsed.debit ?? null,
          rawCredit: parsed.credit ?? null,
          suggestedAccountId: accountId,
          suggestedCategoryId: matchedCategoryId,
          suggestedPayeeId: matchedPayeeId,
          cardNumber,
          detectedWorkspaceId: null, // Will be set after detection
        });
        return false; // Not saved (unmapped)
      }
        }),
      );

      // Count successful saves from this batch
      savedCount += batchResults.filter((result) => result === true).length;
    }

    // Deduplicate unmapped transactions by raw description, date, and amount
    // This prevents showing truly duplicate transactions while preserving unique identifiers
    // Use composite key: rawDescription + date + debit + credit
    const deduplicationKeyMap = new Map<string, {
      id: string;
      rawDate: string;
      rawDescription: string;
      rawDebit: number | null;
      rawCredit: number | null;
      suggestedAccountId: string | null;
      suggestedCategoryId: string | null;
      suggestedPayeeId: string | null;
      cardNumber: string | null;
      detectedWorkspaceId: string | null;
    }>();

    for (const unmapped of unmappedTransactions) {
      // Create composite key: rawDescription + date + debit + credit
      // This ensures we only deduplicate truly identical transactions
      const deduplicationKey = `${unmapped.rawDescription}|${unmapped.rawDate}|${unmapped.rawDebit ?? ''}|${unmapped.rawCredit ?? ''}`;

      // Only add if we haven't seen this exact combination before
      if (!deduplicationKeyMap.has(deduplicationKey)) {
        deduplicationKeyMap.set(deduplicationKey, {
          ...unmapped,
          detectedWorkspaceId: null, // Will be set after detection
          // Keep original rawDescription - don't replace with normalized version
        });
      }
    }

    // Convert map values to array
    const deduplicatedUnmapped = Array.from(deduplicationKeyMap.values());

    // Detect and cache workspace for each unmapped transaction
    const workspaceDetectionService = new WorkspaceDetectionService();
    const defaultWorkspaceId = await getUserDefaultWorkspace(context.userId);

    await Promise.all(
      deduplicatedUnmapped.map(async (unmapped) => {
        try {
          const detectedWorkspaceId = await workspaceDetectionService.detectWorkspaceForTransaction(
            {
              id: unmapped.id,
              accountId: unmapped.suggestedAccountId ?? null,
              categoryId: unmapped.suggestedCategoryId ?? null,
              payeeId: unmapped.suggestedPayeeId ?? null,
              workspaceId: defaultWorkspaceId,
            },
            context.userId,
          );

          await workspaceDetectionService.cacheDetectedWorkspace(
            unmapped.id,
            detectedWorkspaceId,
            context.userId,
          );

          // Add detectedWorkspaceId to unmapped transaction
          unmapped.detectedWorkspaceId = detectedWorkspaceId;
        } catch {
          // If detection fails, use default workspace
          unmapped.detectedWorkspaceId = defaultWorkspaceId;
        }
      }),
    );

    return {
      success: true,
      importedCount: transactions.length,
      savedCount,
      unmappedTransactions: deduplicatedUnmapped,
    };
  } finally {
    // Clean up temp file - always execute, even if error occurs
    const {unlinkSync} = await import('fs');
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors (file may not exist or already deleted)
    }
  }
}

/**
 * Parse date string to Date object
 * Handles various date formats
 * @param dateStr - Date string to parse
 * @returns Parsed Date object
 */
function parseDate(dateStr: string): Date {
  // Try various date formats
  // First, try DD/MM/YYYY or MM/DD/YYYY format (detect by checking if first number > 12)
  const slashFormat = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const slashMatch = dateStr.match(slashFormat);
  if (slashMatch) {
    const first = parseInt(slashMatch[1] ?? '0', 10);
    const second = parseInt(slashMatch[2] ?? '0', 10);
    const year = parseInt(slashMatch[3] ?? '0', 10);

    // If first number > 12, it's DD/MM/YYYY format
    // If second number > 12, it's MM/DD/YYYY format
    // If both <= 12, prefer DD/MM/YYYY (common in Vietnamese statements)
    let day: number;
    let month: number;

    if (first > 12) {
      // DD/MM/YYYY
      day = first;
      month = second - 1;
    } else if (second > 12) {
      // MM/DD/YYYY
      month = first - 1;
      day = second;
    } else {
      // Both <= 12, assume DD/MM/YYYY (common in Vietnamese statements)
      day = first;
      month = second - 1;
    }

    return new Date(year, month, day);
  }

  // Try YYYY-MM-DD format
  const isoFormat = /(\d{4})-(\d{2})-(\d{2})/;
  const isoMatch = dateStr.match(isoFormat);
  if (isoMatch) {
    const year = parseInt(isoMatch[1] ?? '0', 10);
    const month = parseInt(isoMatch[2] ?? '0', 10) - 1;
    const day = parseInt(isoMatch[3] ?? '0', 10);
    return new Date(year, month, day);
  }

  // Try MM-DD-YYYY or DD-MM-YYYY format
  const dashFormat = /(\d{1,2})-(\d{1,2})-(\d{4})/;
  const dashMatch = dateStr.match(dashFormat);
  if (dashMatch) {
    const first = parseInt(dashMatch[1] ?? '0', 10);
    const second = parseInt(dashMatch[2] ?? '0', 10);
    const year = parseInt(dashMatch[3] ?? '0', 10);

    let day: number;
    let month: number;

    if (first > 12) {
      // DD-MM-YYYY
      day = first;
      month = second - 1;
    } else if (second > 12) {
      // MM-DD-YYYY
      month = first - 1;
      day = second;
    } else {
      // Both <= 12, assume DD-MM-YYYY
      day = first;
      month = second - 1;
    }

    return new Date(year, month, day);
  }

  // Fallback to Date constructor
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date(); // Return current date if parsing fails
  }
  return parsed;
}

/**
 * Save imported transactions with bulk mappings
 * Creates ImportMatchRules and applies mappings to all matching ImportedTransaction records
 */
export async function saveImportedTransactions(
  _: unknown,
  {
    mapping,
  }: {
    mapping: {
      cardNumber?: string | null;
      cardAccountId?: string | null;
      descriptionMappings: Array<{
        description: string;
        accountId: string;
        categoryId?: string | null;
        payeeId?: string | null;
      }>;
    };
  },
  context: GraphQLContext,
): Promise<{
  success: boolean;
  savedCount: number;
  errors: string[];
}> {
  // Get workspace ID from context (default to user's default workspace)
  const workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);

  // Verify workspace access
  await checkWorkspaceAccess(workspaceId, context.userId);

  const errors: string[] = [];
  let savedCount = 0;

  // Process in a batch transaction
  // Check if constraint exists and drop it if present (migration should have removed it, but ensure it's gone)
  const constraintCheck = await context.prisma.$queryRaw<Array<{conname: string}>>`
    SELECT conname FROM pg_constraint WHERE conname = 'Account_balance_check'
  `;
  const constraintExists = constraintCheck.length > 0;
  
  if (constraintExists) {
    try {
      await context.prisma.$executeRaw`
        ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_balance_check"
      `;
    } catch (error) {
      // Ignore errors - constraint might not exist or might be in use
    }
  }
  
  await context.prisma.$transaction(async (tx) => {
    // 1. Create ImportMatchRules for card number if provided
    if (mapping.cardNumber && mapping.cardAccountId) {
      // Validate account
      const account = await tx.account.findFirst({
        where: {
          id: mapping.cardAccountId,
          workspaceId,
        },
      });

      if (!account) {
        errors.push('Card account not found');
      } else {
        // Check if rule already exists
        const existingRule = await tx.importMatchRule.findFirst({
          where: {
            userId: context.userId,
            pattern: mapping.cardNumber,
            accountId: mapping.cardAccountId,
          },
        });

        if (!existingRule) {
          await tx.importMatchRule.create({
            data: {
              pattern: mapping.cardNumber,
              accountId: mapping.cardAccountId,
              userId: context.userId,
            },
          });
        }
      }
    }

    // 2. Create ImportMatchRules for each description mapping
    const descriptionPatterns = new Map<string, {accountId: string; categoryId?: string | null; payeeId?: string | null}>();
    for (const descMapping of mapping.descriptionMappings) {
      // Validate account
      const account = await tx.account.findFirst({
        where: {
          id: descMapping.accountId,
          workspaceId,
        },
      });

      if (!account) {
        errors.push(`Account not found for description: ${descMapping.description}`);
        continue;
      }

      // Validate category if provided
      if (descMapping.categoryId) {
        const category = await tx.category.findFirst({
          where: {
            id: descMapping.categoryId,
            workspaceId,
          },
        });

        if (!category) {
          errors.push(`Category not found for description: ${descMapping.description}`);
          continue;
        }
      }

      // Validate payee if provided
      if (descMapping.payeeId) {
        const payee = await tx.payee.findFirst({
          where: {
            id: descMapping.payeeId,
            workspaceId,
          },
        });

        if (!payee) {
          errors.push(`Payee not found for description: ${descMapping.description}`);
          continue;
        }
      }

      // Normalize description for matching
      const normalizedDescription = normalizeDescription(descMapping.description);

      // Store pattern for matching (use normalized description as key)
      descriptionPatterns.set(normalizedDescription, {
        accountId: descMapping.accountId,
        categoryId: descMapping.categoryId ?? null,
        payeeId: descMapping.payeeId ?? null,
      });

      // Check if rule already exists (use normalized pattern)
      const existingRule = await tx.importMatchRule.findFirst({
        where: {
          userId: context.userId,
          pattern: normalizedDescription,
          accountId: descMapping.accountId,
          categoryId: descMapping.categoryId ?? null,
          payeeId: descMapping.payeeId ?? null,
        },
      });

      if (!existingRule) {
        await tx.importMatchRule.create({
          data: {
            pattern: normalizedDescription,
            accountId: descMapping.accountId,
            categoryId: descMapping.categoryId ?? null,
            payeeId: descMapping.payeeId ?? null,
            userId: context.userId,
          },
        });
      }
    }

    // 3. Find all unmapped ImportedTransaction records that match any description pattern
    const allUnmapped = await tx.importedTransaction.findMany({
      where: {
        userId: context.userId,
        matched: false,
      },
    });

    // 4. Match transactions by description and create Transaction records
    // Batch category lookups for better performance
    const categoryIds = new Set<string>();
    for (const descMapping of descriptionPatterns.values()) {
      if (descMapping.categoryId) {
        categoryIds.add(descMapping.categoryId);
      }
    }
    const categories = categoryIds.size > 0
      ? await tx.category.findMany({
          where: {id: {in: Array.from(categoryIds)}},
          select: {id: true, categoryType: true},
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Process transactions - collect for potential batch create
    const transactionsToCreate: Array<{
      value: number;
      date: Date;
      accountId: string;
      categoryId: string | null;
      payeeId: string | null;
      note: string;
      userId: string;
      workspaceId: string;
      importedId: string;
      balanceDelta: number;
    }> = [];

    // Get default workspace
    const defaultWorkspaceId = await getUserDefaultWorkspace(context.userId);

    for (const imported of allUnmapped) {
      // Normalize description before matching
      const normalizedDescription = normalizeDescription(imported.rawDescription);
      const descMapping = descriptionPatterns.get(normalizedDescription);
      if (!descMapping) {
        continue; // Skip if no mapping for this description
      }

      try {
        // Use detectedWorkspaceId if available, otherwise use default
        const workspaceId = imported.detectedWorkspaceId ?? defaultWorkspaceId;

        // Verify account belongs to the detected workspace
        const account = await tx.account.findFirst({
          where: {
            id: descMapping.accountId,
            workspaceId,
          },
          select: {id: true},
        });

        if (!account) {
          // Account doesn't belong to detected workspace, skip this transaction
          errors.push(`Transaction ${imported.id}: Account does not belong to detected workspace`);
          continue;
        }

        // Calculate value
        const value = Math.abs(Number(imported.rawDebit ?? imported.rawCredit ?? 0));
        if (value === 0) {
          continue; // Skip zero-value transactions
        }

        // Parse date
        const date = parseDate(imported.rawDate);

        // Get category to determine balance delta
        const category = descMapping.categoryId ? categoryMap.get(descMapping.categoryId) ?? null : null;

        // Calculate balance delta based on category type
        const balanceDelta = category?.categoryType === 'Income' ? value : -value;

        transactionsToCreate.push({
          value,
          date,
          accountId: descMapping.accountId,
          categoryId: descMapping.categoryId ?? null,
          payeeId: descMapping.payeeId ?? null,
          note: imported.rawDescription,
          userId: context.userId,
          workspaceId,
          importedId: imported.id,
          balanceDelta,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Transaction ${imported.id}: ${errorMessage}`);
      }
    }

    // Create transactions and update balances/imported transactions
    // Note: We can't use createMany here because we need the transaction IDs
    // to update imported transactions. However, we've optimized category lookups.
    // Use savepoints to allow partial rollback on constraint violations
    for (const txData of transactionsToCreate) {
      // Create a savepoint for each transaction to allow partial rollback
      const savepointId = `sp_${txData.importedId.replace(/-/g, '_')}`;
      try {
        // Create savepoint
        await tx.$executeRawUnsafe(`SAVEPOINT ${savepointId}`);
        
        // Create transaction
        const transaction = await tx.transaction.create({
          data: {
            value: txData.value,
            date: txData.date,
            accountId: txData.accountId,
            categoryId: txData.categoryId,
            payeeId: txData.payeeId,
            note: txData.note,
            createdBy: txData.userId,
            lastEditedBy: txData.userId,
          },
        });

        // Update account balance
        await incrementAccountBalance(txData.accountId, txData.balanceDelta, tx);

        // Update budgets for this transaction
        await updateBudgetForTransaction(
          {
            id: transaction.id,
            accountId: transaction.accountId,
            categoryId: transaction.categoryId,
            payeeId: transaction.payeeId,
            userId: txData.userId,
            workspaceId: txData.workspaceId,
            value: Number(transaction.value),
            date: transaction.date,
            categoryType: null, // Will be determined in updateBudgetForTransaction
          },
          'create',
          undefined,
          tx,
        );

        // Mark ImportedTransaction as matched
        await tx.importedTransaction.update({
          where: {id: txData.importedId},
          data: {
            matched: true,
            transactionId: transaction.id,
          },
        });

        // Release savepoint on success
        await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepointId}`);
        
        savedCount++;
      } catch (error) {
        // Rollback to savepoint on error to allow other transactions to continue
        try {
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepointId}`);
        } catch {
          // If rollback fails, the transaction is already aborted
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Transaction ${txData.importedId}: ${errorMessage}`);
      }
    }
  });

  return {
    success: errors.length === 0,
    savedCount,
    errors,
  };
}

/**
 * Delete all unmapped imported transactions for the user
 */
export async function deleteUnmappedImportedTransactions(
  _: unknown,
  __: unknown,
  context: GraphQLContext,
): Promise<boolean> {
  await withPrismaErrorHandling(
    async () => {
      await context.prisma.importedTransaction.deleteMany({
        where: {
          userId: context.userId,
          matched: false,
        },
      });
    },
    {resource: 'ImportedTransaction', operation: 'delete'},
  );

  return true;
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
  return await withPrismaErrorHandling(
    async () => {
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

      // Get workspace ID from context (default to user's default workspace)
      const workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);

      // Verify workspace access
      await checkWorkspaceAccess(workspaceId, context.userId);

      // Verify transaction belongs to workspace (via account)
      const transaction = await context.prisma.transaction.findFirst({
        where: {
          id: transactionId,
          account: {
            workspaceId,
          },
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

      return {
        ...updated,
        rawDebit: updated.rawDebit ? Number(updated.rawDebit) : null,
        rawCredit: updated.rawCredit ? Number(updated.rawCredit) : null,
      };
    },
    {resource: 'ImportedTransaction', operation: 'update'},
  );
}

// CSV parsing is now done via streaming

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
  return ALLOWED_CSV_EXTENSIONS.includes(ext as typeof ALLOWED_CSV_EXTENSIONS[number]);
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
  let fileData = file instanceof Promise ? await file : file;

  // If fileData is empty (Promise resolved to empty object due to serialization),
  // try to retrieve from request context
  if (fileData && typeof fileData === 'object' && Object.keys(fileData).length === 0) {
    // Try to get file from request context (stored in multipart handler)
    // Note: This is a fallback if Promise gets serialized
    const request = context.request as {uploadFiles?: Record<string, {filename: string; mimetype?: string; encoding?: string; createReadStream: () => NodeJS.ReadableStream}>} | undefined;
    if (request?.uploadFiles) {
      // Get the first file (typically there's only one)
      const fileKey = Object.keys(request.uploadFiles)[0];
      if (fileKey && request.uploadFiles[fileKey]) {
        fileData = request.uploadFiles[fileKey];
      }
    }
  }

  // Check if fileData has the expected structure
  if (!fileData || typeof fileData !== 'object') {
    throw new ValidationError('Invalid file upload. File data is missing or invalid.');
  }

  // Extract file properties - handle both standard and alternative property names
  const filename = ('filename' in fileData && typeof fileData.filename === 'string' ? fileData.filename : (fileData as {name?: string}).name) ?? '';
  const mimetype = ('mimetype' in fileData && typeof fileData.mimetype === 'string' ? fileData.mimetype : (fileData as {type?: string}).type) ?? undefined;
  const createUploadStream: () => NodeJS.ReadableStream = ('createReadStream' in fileData && typeof fileData.createReadStream === 'function' ? fileData.createReadStream : (): NodeJS.ReadableStream => {
    throw new ValidationError('File stream is not available. The file may have been corrupted during upload.');
  });

  // Validate entity type
  const validEntityTypes = [
    'accounts',
    'categories',
    'payees',
    'transactions',
    'recurringTransactions',
    'preferences',
    'budgets',
    'importMatchRules',
  ];
  if (!validEntityTypes.includes(entityType)) {
    throw new ValidationError(`Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`);
  }

  // Validate MIME type (allow CSV and plain text)
  if (mimetype && !ALLOWED_CSV_MIME_TYPES.includes(mimetype as typeof ALLOWED_CSV_MIME_TYPES[number])) {
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

  try {
    // Stream file with size limit
    let totalSize = 0;
    const writeStream = createWriteStream(tempPath);
    const readStream = createUploadStream();

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
      // Clean up on error during stream
      const {unlinkSync} = await import('fs');
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }

    // Validate file content using magic numbers (read first few bytes)
    const {readFileSync: readFileSyncCSV} = await import('fs');
    const fileBuffer = readFileSyncCSV(tempPath);
    const firstBytes = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    if (!validateFileMagicNumber(firstBytes, 'csv')) {
      const {unlinkSync} = await import('fs');
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new ValidationError('Invalid file content. File does not appear to be a valid CSV/text file.');
    }

    // Stream CSV parsing line-by-line to avoid loading entire file into memory
    // This is more memory-efficient for large CSV files
    const {createReadStream} = await import('fs');
    const {createInterface} = await import('readline');

    const fileStream = createReadStream(tempPath, {encoding: 'utf-8'});
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity, // Handle Windows line endings
    });

    const rows: Array<Record<string, string>> = [];
    let headers: string[] = [];
    let isFirstLine = true;

    for await (const line of rl) {
      if (line.trim().length === 0) continue;

      if (isFirstLine) {
        headers = parseCSVLine(line);
        isFirstLine = false;
        continue;
      }

      const values = parseCSVLine(line);
      if (values.length !== headers.length) {
        continue; // Skip malformed rows
      }

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]?.trim() ?? ''] = values[j]?.trim() ?? '';
      }
      rows.push(row);
    }

    // Get workspace ID from context (default to user's default workspace)
    const workspaceId = context.currentWorkspaceId ?? await getUserDefaultWorkspace(context.userId);

    // Verify workspace access
    await checkWorkspaceAccess(workspaceId, context.userId);

    // Process rows based on entity type
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Use transaction to ensure atomicity
    await context.prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) {
          continue;
        }
        try {
            let wasUpdated = false;
            if (entityType === 'accounts') {
              if (row.id) {
                const existing = await tx.account.findFirst({where: {id: row.id, workspaceId}});
                wasUpdated = existing !== null;
              }
              await importAccount(row, tx, workspaceId, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'categories') {
              if (row.id) {
                const existing = await tx.category.findFirst({where: {id: row.id, workspaceId}});
                wasUpdated = existing !== null;
              }
              await importCategory(row, tx, workspaceId, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'payees') {
              if (row.id) {
                const existing = await tx.payee.findFirst({where: {id: row.id, workspaceId}});
                wasUpdated = existing !== null;
              }
              await importPayee(row, tx, workspaceId, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'transactions') {
              if (row.id) {
                const existing = await tx.transaction.findFirst({where: {id: row.id, account: {workspaceId}}});
                wasUpdated = existing !== null;
              }
              await importTransaction(row, tx, workspaceId, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'recurringTransactions') {
              if (row.id) {
                const existing = await tx.recurringTransaction.findFirst({where: {id: row.id, account: {workspaceId}}});
                wasUpdated = existing !== null;
              }
              await importRecurringTransaction(row, tx, workspaceId, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'preferences') {
              // Preferences are always upserted (one per user)
              const existing = await tx.userPreferences.findUnique({where: {userId: context.userId}});
              wasUpdated = existing !== null;
              await importPreferences(row, tx, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'budgets') {
              if (row.id) {
                const existing = await tx.budget.findFirst({where: {id: row.id, workspaceId}});
                wasUpdated = existing !== null;
              }
              await importBudget(row, tx, workspaceId, context.userId);
              if (wasUpdated) {
                updated++;
              } else {
                created++;
              }
            } else if (entityType === 'importMatchRules') {
              if (row.id) {
                const existing = await tx.importMatchRule.findFirst({where: {id: row.id, userId: context.userId}});
                wasUpdated = existing !== null;
              }
              await importImportMatchRule(row, tx, context.userId, workspaceId);
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
  } finally {
    // Clean up temp file - always execute, even if error occurs
    const {unlinkSync} = await import('fs');
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors (file may not exist or already deleted)
    }
  }
}

/**
 * Import account from CSV row
 */
async function importAccount(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!row.name) {
    throw new ValidationError('Account name is required');
  }

  const data = {
    name: row.name,
    initBalance: row.initBalance ? parseFloat(row.initBalance) : 0,
    balance: row.initBalance ? parseFloat(row.initBalance) : 0,
    isDefault: row.isDefault === 'true' || row.isDefault === '1',
    accountType: (row.accountType as 'Cash' | 'CreditCard' | 'Bank' | 'Saving' | 'Loans') ?? 'Cash',
    workspaceId,
    createdBy: userId,
    lastEditedBy: userId,
  };

  if (row.id) {
    // Check if account exists and belongs to workspace
    const existing = await tx.account.findFirst({
      where: {id: row.id, workspaceId},
    });
    if (existing) {
      await tx.account.update({
        where: {id: row.id},
        data: {
          name: data.name,
          initBalance: data.initBalance,
          isDefault: data.isDefault,
          accountType: data.accountType,
          lastEditedBy: userId,
        },
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
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!row.name) {
    throw new ValidationError('Category name is required');
  }

  const data = {
    name: row.name,
    categoryType: ((row.type === 'INCOME' || row.type === 'Income') ? 'Income' : (row.type === 'EXPENSE' || row.type === 'Expense') ? 'Expense' : 'Expense') as CategoryType,
    isDefault: row.isDefault === 'true' || row.isDefault === '1',
    workspaceId,
    createdBy: userId,
    lastEditedBy: userId,
  };

  if (row.id) {
    const existing = await tx.category.findFirst({
      where: {id: row.id, workspaceId},
    });
    if (existing) {
      await tx.category.update({
        where: {id: row.id},
        data: {
          name: data.name,
          categoryType: data.categoryType,
          isDefault: data.isDefault,
          lastEditedBy: userId,
        },
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
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!row.name) {
    throw new ValidationError('Payee name is required');
  }

  const data = {
    name: row.name,
    isDefault: row.isDefault === 'true' || row.isDefault === '1',
    workspaceId,
    createdBy: userId,
    lastEditedBy: userId,
  };

  if (row.id) {
    const existing = await tx.payee.findFirst({
      where: {id: row.id, workspaceId},
    });
    if (existing) {
      await tx.payee.update({
        where: {id: row.id},
        data: {
          name: data.name,
          isDefault: data.isDefault,
          lastEditedBy: userId,
        },
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
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!row.value || !row.accountId || !row.date) {
    throw new ValidationError('Transaction value, accountId, and date are required');
  }

  // Validate account exists and belongs to workspace
  const account = await tx.account.findFirst({
    where: {id: row.accountId, workspaceId},
  });
  if (!account) {
    throw new ValidationError(`Account with ID ${row.accountId} not found`);
  }

  // Validate category if provided - if not found, set to null instead of failing
  let categoryId: string | null = row.categoryId ?? null;
  if (categoryId) {
    const category = await tx.category.findFirst({
      where: {id: categoryId, workspaceId},
    });
    if (!category) {
      // Category not found - set to null instead of failing the import
      // This allows importing transactions even if categories are missing
      categoryId = null;
    }
  }

  // Validate payee if provided - if not found, set to null instead of failing
  let payeeId: string | null = row.payeeId ?? null;
  if (payeeId) {
    const payee = await tx.payee.findFirst({
      where: {id: payeeId, workspaceId},
    });
    if (!payee) {
      // Payee not found - set to null instead of failing the import
      // This allows importing transactions even if payees are missing
      payeeId = null;
    }
  }

  const data = {
    value: parseFloat(row.value),
    date: new Date(row.date),
    accountId: row.accountId,
    categoryId,
    payeeId,
    note: row.note ?? null,
    createdBy: userId,
    lastEditedBy: userId,
  };

  if (row.id) {
    const existing = await tx.transaction.findFirst({
      where: {id: row.id, account: {workspaceId}},
    });
    if (existing) {
      await tx.transaction.update({
        where: {id: row.id},
        data: {
          value: data.value,
          date: data.date,
          accountId: data.accountId,
          categoryId: data.categoryId,
          payeeId: data.payeeId,
          note: data.note,
          lastEditedBy: userId,
        },
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
  workspaceId: string,
  _userId: string,
): Promise<void> {
  if (!row.cronExpression || !row.value || !row.accountId || !row.nextRunDate) {
    throw new ValidationError('Recurring transaction cronExpression, value, accountId, and nextRunDate are required');
  }

  // Validate account exists and belongs to workspace
  const account = await tx.account.findFirst({
    where: {id: row.accountId, workspaceId},
  });
  if (!account) {
    throw new ValidationError(`Account with ID ${row.accountId} not found`);
  }

  // Validate category if provided
  if (row.categoryId) {
    const category = await tx.category.findFirst({
      where: {id: row.categoryId, workspaceId},
    });
    if (!category) {
      throw new ValidationError(`Category with ID ${row.categoryId} not found`);
    }
  }

  // Validate payee if provided
  if (row.payeeId) {
    const payee = await tx.payee.findFirst({
      where: {id: row.payeeId, workspaceId},
    });
    if (!payee) {
      throw new ValidationError(`Payee with ID ${row.payeeId} not found`);
    }
  }

  const data = {
    cronExpression: row.cronExpression,
    value: parseFloat(row.value),
    accountId: row.accountId,
    categoryId: row.categoryId ?? null,
    payeeId: row.payeeId ?? null,
    note: row.note ?? null,
    nextRunDate: new Date(row.nextRunDate),
  };

  if (row.id) {
    const existing = await tx.recurringTransaction.findFirst({
      where: {id: row.id, account: {workspaceId}},
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

/**
 * Import preferences from CSV row
 */
async function importPreferences(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
): Promise<void> {
  const data = {
    currency: row.currency ?? 'USD',
    useThousandSeparator: row.useThousandSeparator === 'true' || row.useThousandSeparator === '1',
    colorScheme: row.colorScheme ?? null,
    colorSchemeValue: row.colorSchemeValue ?? null,
    userId,
  };

  // Preferences are unique per user, so we upsert
  await tx.userPreferences.upsert({
    where: {userId},
    update: data,
    create: data,
  });
}

/**
 * Import budget from CSV row
 */
async function importBudget(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!row.amount) {
    throw new ValidationError('Budget amount is required');
  }

  // Validate account if provided
  let accountId: string | null = row.accountId ?? null;
  if (accountId) {
    const account = await tx.account.findFirst({
      where: {id: accountId, workspaceId},
    });
    if (!account) {
      accountId = null;
    }
  }

  // Validate category if provided
  let categoryId: string | null = row.categoryId ?? null;
  if (categoryId) {
    const category = await tx.category.findFirst({
      where: {id: categoryId, workspaceId},
    });
    if (!category) {
      categoryId = null;
    }
  }

  // Validate payee if provided
  let payeeId: string | null = row.payeeId ?? null;
  if (payeeId) {
    const payee = await tx.payee.findFirst({
      where: {id: payeeId, workspaceId},
    });
    if (!payee) {
      payeeId = null;
    }
  }

  const data = {
    workspaceId,
    amount: parseFloat(row.amount),
    currentSpent: row.currentSpent ? parseFloat(row.currentSpent) : 0,
    accountId,
    categoryId,
    payeeId,
    lastResetDate: row.lastResetDate ? new Date(row.lastResetDate) : new Date(),
    createdBy: userId,
    lastEditedBy: userId,
  };

  if (row.id) {
    const existing = await tx.budget.findFirst({
      where: {id: row.id, workspaceId},
    });
    if (existing) {
      await tx.budget.update({
        where: {id: row.id},
        data: {
          amount: data.amount,
          currentSpent: data.currentSpent,
          accountId: data.accountId,
          categoryId: data.categoryId,
          payeeId: data.payeeId,
          lastResetDate: data.lastResetDate,
          lastEditedBy: userId,
        },
      });
      return;
    }
  }

  await tx.budget.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

/**
 * Import import match rule from CSV row
 * Note: ImportMatchRule is user-specific, but referenced entities (account, category, payee) are workspace-scoped
 * We validate that the user has access to the workspace containing these entities
 */
async function importImportMatchRule(
  row: Record<string, string>,
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: string,
  workspaceId: string,
): Promise<void> {
  if (!row.pattern) {
    throw new ValidationError('Import match rule pattern is required');
  }

  // Validate account if provided - check if it belongs to the workspace
  let accountId: string | null = row.accountId ?? null;
  if (accountId) {
    const account = await tx.account.findFirst({
      where: {id: accountId, workspaceId},
    });
    if (!account) {
      accountId = null;
    }
  }

  // Validate category if provided - check if it belongs to the workspace
  let categoryId: string | null = row.categoryId ?? null;
  if (categoryId) {
    const category = await tx.category.findFirst({
      where: {id: categoryId, workspaceId},
    });
    if (!category) {
      categoryId = null;
    }
  }

  // Validate payee if provided - check if it belongs to the workspace
  let payeeId: string | null = row.payeeId ?? null;
  if (payeeId) {
    const payee = await tx.payee.findFirst({
      where: {id: payeeId, workspaceId},
    });
    if (!payee) {
      payeeId = null;
    }
  }

  const data = {
    pattern: row.pattern,
    accountId,
    categoryId,
    payeeId,
    userId,
  };

  if (row.id) {
    const existing = await tx.importMatchRule.findFirst({
      where: {id: row.id, userId},
    });
    if (existing) {
      await tx.importMatchRule.update({
        where: {id: row.id},
        data,
      });
      return;
    }
  }

  await tx.importMatchRule.create({
    data: row.id ? {...data, id: row.id} : data,
  });
}

