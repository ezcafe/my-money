/**
 * File Upload Helper Functions
 * Extracted from ImportResolver to reduce function complexity and improve maintainability
 */

import { createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { ValidationError } from '../utils/errors';
import { sanitizeFilename } from '../resolvers/ImportResolver';
import { MAX_PDF_FILE_SIZE, MAX_CSV_FILE_SIZE } from '../utils/constants';

const streamPipeline = promisify(pipeline);

/**
 * Extract file properties from upload file object
 * Handles both standard and alternative property names
 */
export function extractFileProperties(fileData: {
  filename?: string;
  name?: string;
  mimetype?: string;
  type?: string;
  createReadStream?: () => NodeJS.ReadableStream;
}): {
  filename: string;
  mimetype?: string;
  createReadStream: () => NodeJS.ReadableStream;
} {
  const filename = fileData.filename ?? fileData.name;
  const mimetype = fileData.mimetype ?? fileData.type;
  const createReadStream = fileData.createReadStream;

  if (!filename) {
    throw new ValidationError('Invalid file upload. Filename is missing.');
  }

  if (!createReadStream || typeof createReadStream !== 'function') {
    throw new ValidationError('Invalid file upload. File stream is missing.');
  }

  return { filename, mimetype, createReadStream };
}

/**
 * Stream file to temporary location with size monitoring
 * @param readStream - File read stream
 * @param maxSize - Maximum file size in bytes
 * @param tempPath - Temporary file path
 */
export async function streamFileWithSizeLimit(
  readStream: NodeJS.ReadableStream,
  maxSize: number,
  tempPath: string
): Promise<void> {
  let totalSize = 0;
  const writeStream = createWriteStream(tempPath);

  // Monitor file size during upload
  readStream.on('data', (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      if ('destroy' in readStream && typeof readStream.destroy === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        readStream.destroy();
      }
      writeStream.destroy();
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
      );
    }
  });

  try {
    await streamPipeline(readStream, writeStream);
  } catch (error) {
    // Clean up on error during stream
    await cleanupTempFile(tempPath);
    throw error;
  }
}

/**
 * Create temporary file path with sanitized filename
 */
export function createTempFilePath(filename: string): string {
  const sanitizedFilename = sanitizeFilename(filename);
  return join(tmpdir(), `${randomUUID()}-${sanitizedFilename}`);
}

/**
 * Clean up temporary file
 */
export async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(tempPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Validate and stream PDF file
 */
export async function validateAndStreamPDF(
  fileData: {
    filename?: string;
    name?: string;
    mimetype?: string;
    type?: string;
    createReadStream?: () => NodeJS.ReadableStream;
  },
  validateFileExtension: (filename: string) => boolean,
  validateFileMagicNumber: (buffer: Buffer, type: 'pdf' | 'csv') => boolean,
  allowedMimeTypes: string[]
): Promise<string> {
  const { filename, mimetype, createReadStream } =
    extractFileProperties(fileData);

  // Validate MIME type
  if (mimetype && !allowedMimeTypes.includes(mimetype)) {
    throw new ValidationError(
      `Invalid file type. Only PDF files are allowed. Received: ${mimetype}`
    );
  }

  // Validate file extension
  if (!validateFileExtension(filename)) {
    throw new ValidationError(
      'Invalid file extension. Only .pdf files are allowed.'
    );
  }

  const tempPath = createTempFilePath(filename);
  const readStream = createReadStream();

  try {
    await streamFileWithSizeLimit(readStream, MAX_PDF_FILE_SIZE, tempPath);

    // Validate file content using magic numbers
    const { readFileSync } = await import('fs');
    const buffer: Buffer = readFileSync(tempPath) as Buffer;

    if (!validateFileMagicNumber(buffer, 'pdf')) {
      await cleanupTempFile(tempPath);
      throw new ValidationError(
        'Invalid file content. File does not appear to be a valid PDF file.'
      );
    }

    return tempPath;
  } catch (error) {
    await cleanupTempFile(tempPath);
    throw error;
  }
}

/**
 * Validate and stream CSV file
 */
export async function validateAndStreamCSV(
  fileData: {
    filename?: string;
    name?: string;
    mimetype?: string;
    type?: string;
    createReadStream?: () => NodeJS.ReadableStream;
  },
  validateFileExtension: (filename: string) => boolean,
  validateFileMagicNumber: (buffer: Buffer, type: 'pdf' | 'csv') => boolean,
  allowedMimeTypes: string[],
  maxFileSize: number = MAX_CSV_FILE_SIZE
): Promise<string> {
  const { filename, mimetype, createReadStream } =
    extractFileProperties(fileData);

  // Validate MIME type (be lenient for CSV)
  if (mimetype && !allowedMimeTypes.includes(mimetype)) {
    if (!mimetype.includes('csv') && !mimetype.includes('text')) {
      throw new ValidationError(
        `Invalid file type. Only CSV files are allowed. Received: ${mimetype}`
      );
    }
  }

  // Validate file extension
  if (!validateFileExtension(filename)) {
    throw new ValidationError(
      'Invalid file extension. Only .csv files are allowed.'
    );
  }

  const tempPath = createTempFilePath(filename);
  const readStream = createReadStream();

  try {
    await streamFileWithSizeLimit(readStream, maxFileSize, tempPath);

    // Validate file content using magic numbers
    const { readFileSync } = await import('fs');
    const fileBuffer = readFileSync(tempPath);
    const firstBytes = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from(fileBuffer);

    if (!validateFileMagicNumber(firstBytes, 'csv')) {
      await cleanupTempFile(tempPath);
      throw new ValidationError(
        'Invalid file content. File does not appear to be a valid CSV/text file.'
      );
    }

    return tempPath;
  } catch (error) {
    await cleanupTempFile(tempPath);
    throw error;
  }
}
