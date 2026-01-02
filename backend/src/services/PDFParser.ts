/**
 * PDF Parser Service
 * Extracts transaction data from credit card statement PDFs
 */

import pdfParse from 'pdf-parse';
import {logDebug} from '../utils/logger';

export interface ParsedTransaction {
  date: string;
  description: string;
  debit?: number;
  credit?: number;
}

export interface ParsedPDFData {
  cardNumber: string | null;
  transactions: ParsedTransaction[];
}

/**
 * Extract last 4 digits from a card number string
 * @param cardNumber - Card number string (can contain non-digits)
 * @returns Last 4 digits or null if not found
 */
function extractLast4Digits(cardNumber: string): string | null {
  // Remove all non-digits
  const digits = cardNumber.replace(/\D/g, '');
  // Return last 4 digits if we have at least 4 digits
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return null;
}

/**
 * Extract card number from PDF text
 * Tries multiple approaches: label search and masked pattern matching
 * Returns only the last 4 digits
 * @param text - PDF text content
 * @returns Extracted card number (last 4 digits) or null
 */
export function extractCardNumber(text: string): string | null {
  // Approach 1: Search for "Card Number:" label followed by digits
  const labelPatterns = [
    /Card\s+Number[:\s]+(\d{4,})/i,
    /Card\s*#\s*[:\s]+(\d{4,})/i,
    /Card\s+ending\s+in[:\s]+(\d{4,})/i,
    /Account\s+Number[:\s]+(\d{4,})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const last4 = extractLast4Digits(match[1].trim());
      if (last4) {
        return last4;
      }
    }
  }

  // Approach 2: Look for masked patterns like ****1234 or **** **** **** 1234
  const maskedPatterns = [
    /\*{4}\s*\*{4}\s*\*{4}\s*(\d{4})/, // **** **** **** 1234
    /\*{3,}\s*(\d{4})/, // ***1234 or ****1234
    /x{4}\s*x{4}\s*x{4}\s*(\d{4})/i, // xxxx xxxx xxxx 1234
    /\d+x{4,}\s*(\d{4})/, // 402737xxxxxx9656 -> captures 9656
    /\d+\s*x{4,}\s*(\d{4})/, // handles spaces between digits and x's
  ];

  for (const pattern of maskedPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Validate if a date string matches the specified format
 * @param dateStr - Date string to validate
 * @param format - Date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY)
 * @returns True if date matches the format pattern
 */
function isValidDate(dateStr: string, format: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return false;
  }

  // Create regex pattern based on format
  let pattern: RegExp;
  switch (format) {
    case 'DD/MM/YYYY':
      pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      break;
    case 'MM/DD/YYYY':
      pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      break;
    case 'YYYY-MM-DD':
      pattern = /^(\d{4})-(\d{2})-(\d{2})$/;
      break;
    case 'DD-MM-YYYY':
      pattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      break;
    case 'MM-DD-YYYY':
      pattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      break;
    default:
      // Default to DD/MM/YYYY
      pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  }

  const match = trimmed.match(pattern);
  if (!match) {
    return false;
  }

  // Validate date values
  let day: number;
  let month: number;
  const year = parseInt(match[3] ?? '0', 10);

  if (format === 'YYYY-MM-DD') {
    month = parseInt(match[2] ?? '0', 10);
    day = parseInt(match[1] ?? '0', 10);
  } else if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
    month = parseInt(match[1] ?? '0', 10);
    day = parseInt(match[2] ?? '0', 10);
  } else {
    // DD/MM/YYYY or DD-MM-YYYY
    day = parseInt(match[1] ?? '0', 10);
    month = parseInt(match[2] ?? '0', 10);
  }

  // Validate ranges
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > 31) {
    return false;
  }
  if (year < 1900 || year > 2100) {
    return false;
  }

  // Check if date is valid (e.g., not Feb 30)
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }

  return true;
}

/**
 * Parse date string according to specified format
 * @param dateStr - Date string to parse
 * @param format - Date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY)
 * @returns Parsed date string in the same format, or original string if parsing fails
 */
function parseDateByFormat(dateStr: string, format: string): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return dateStr;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return dateStr;
  }

  // Try to match the format pattern
  let pattern: RegExp;
  switch (format) {
    case 'DD/MM/YYYY':
      pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      break;
    case 'MM/DD/YYYY':
      pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      break;
    case 'YYYY-MM-DD':
      pattern = /^(\d{4})-(\d{2})-(\d{2})/;
      break;
    case 'DD-MM-YYYY':
      pattern = /^(\d{1,2})-(\d{1,2})-(\d{4})/;
      break;
    case 'MM-DD-YYYY':
      pattern = /^(\d{1,2})-(\d{1,2})-(\d{4})/;
      break;
    default:
      // Default to DD/MM/YYYY
      pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  }

  const match = trimmed.match(pattern);
  if (!match) {
    return dateStr;
  }

  // Return the matched date part
  return match[0] ?? dateStr;
}

/**
 * Parse transaction table from PDF text
 * Strictly parses from table structure with specific column headers
 * Only parses tables with description column and rows with valid date information
 * @param text - PDF text content
 * @param dateFormat - Date format to use for validation (default: DD/MM/YYYY)
 * @returns Array of parsed transactions, empty array if table structure not found
 */
export function parseTransactionTable(text: string, dateFormat: string = 'DD/MM/YYYY'): ParsedTransaction[] {
  const lines = text.split('\n');
  const transactions: ParsedTransaction[] = [];

  // Find ALL tables with description columns - process each one
  let currentLineIndex = 0;

  while (currentLineIndex < lines.length) {
    // Find table header - handle both single-line and multi-line headers
    let dateColumnIndex = -1;
    let descriptionColumnIndex = -1;
    let amountColumnIndex = -1;
    let headerRowIndex = -1;
    let dataStartRowIndex = -1;

    // First, try to find single-line header (original logic)
    for (let i = currentLineIndex; i < lines.length; i++) {
      const line = lines[i]?.toLowerCase();
      if (!line) continue;

      // Check if this line contains "transaction date" and "description"
      const hasTransactionDate = line.includes('transaction date');
      const hasDescription = line.includes('description');

      // Check for amount column (Amounts, Debit, Credit, or Paid)
      const hasAmount = line.includes('amounts') ||
                       line.includes('debit') ||
                       line.includes('credit') ||
                       line.includes('paid');

      if (hasTransactionDate && hasDescription && hasAmount) {
        // Split line by multiple spaces or tabs to get columns
        const columns = line.split(/\s{2,}|\t/).map((col) => col.trim().toLowerCase());

        // Find column indices
        dateColumnIndex = columns.findIndex((col) => col.includes('transaction date') || col.includes('date'));
        descriptionColumnIndex = columns.findIndex((col) => col.includes('description'));

        // Find amount column (check for Amounts, Debit, Credit, or Paid)
        amountColumnIndex = columns.findIndex((col) =>
          col.includes('amounts') ||
          col.includes('debit') ||
          col.includes('credit') ||
          col.includes('paid')
        );

        // All required columns must be found
        if (dateColumnIndex >= 0 && descriptionColumnIndex >= 0 && amountColumnIndex >= 0) {
          headerRowIndex = i;
          dataStartRowIndex = i + 1;
          break;
        }
      }
    }

    // If single-line header not found OR description column not found, try multi-line header detection
    if (headerRowIndex < 0 || descriptionColumnIndex < 0) {
      // Reset indices if we're re-detecting
      if (headerRowIndex >= 0 && descriptionColumnIndex < 0) {
        headerRowIndex = -1;
        dataStartRowIndex = -1;
        dateColumnIndex = -1;
        amountColumnIndex = -1;
      }
      // Look for header keywords across multiple lines (within a window of 100 lines from current position)
      let dateHeaderLine = -1;
      let descriptionHeaderLine = -1;
      let debitHeaderLine = -1;
      let creditHeaderLine = -1;

      for (let i = currentLineIndex; i < Math.min(lines.length, currentLineIndex + 100); i++) {
        const line = lines[i]?.toLowerCase();
        if (!line) continue;

        if ((line.includes('transaction date') || line.includes('posting date')) && dateHeaderLine < 0) {
          dateHeaderLine = i;
        }
        if (line.includes('description') && descriptionHeaderLine < 0) {
          descriptionHeaderLine = i;
        }
        if (line.includes('debit') && line.includes('dr') && debitHeaderLine < 0) {
          debitHeaderLine = i;
        }
        if (line.includes('credit') && line.includes('cr') && creditHeaderLine < 0) {
          creditHeaderLine = i;
        }
      }
      // If we found header keywords, try to detect column positions from data rows
      if (dateHeaderLine >= 0 && descriptionHeaderLine >= 0 && (debitHeaderLine >= 0 || creditHeaderLine >= 0)) {
        headerRowIndex = Math.max(dateHeaderLine, descriptionHeaderLine, debitHeaderLine, creditHeaderLine);

        // Find the first data row by looking for date patterns (MM/DD/YYYY or DD/MM/YYYY)
        for (let i = headerRowIndex + 1; i < Math.min(lines.length, headerRowIndex + 50); i++) {
          const line = lines[i]?.trim();
          if (!line) continue;
          // Look for date pattern at start of line
          const dateMatch = line.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
          if (dateMatch) {
            dataStartRowIndex = i;
            break;
          }
        }

        // Analyze first few data rows to determine column positions
        if (dataStartRowIndex >= 0) {
          // Sample first 5 data rows to find column boundaries
          const sampleRows: string[] = [];
          for (let i = dataStartRowIndex; i < Math.min(dataStartRowIndex + 5, lines.length); i++) {
            const trimmedLine = lines[i]?.trim();
            if (trimmedLine) {
              sampleRows.push(trimmedLine);
            }
          }

          if (sampleRows.length > 0) {
            // Try splitting by multiple spaces to find columns
            const firstRow = sampleRows[0];
            if (firstRow) {
              const columns = firstRow.split(/\s{2,}|\t/).map((col) => col.trim());

              // Find date column (should start with date pattern)
              for (let j = 0; j < columns.length; j++) {
                const col = columns[j];
                if (col?.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/)) {
                  dateColumnIndex = j;
                  break;
                }
              }

              // Find description column (usually after date, contains text)
              // Rule 1: Process tables with description column
              for (let j = (dateColumnIndex >= 0 ? dateColumnIndex + 1 : 0); j < columns.length; j++) {
                const col = columns[j];
                if (col && col.length > 3 && !col.match(/^[\d,.\s]+$/)) {
                  descriptionColumnIndex = j;
                  break;
                }
              }
              // Find amount column (contains numbers with commas, ends with DR/CR or just numbers)
              for (let j = Math.max(dateColumnIndex, descriptionColumnIndex) + 1; j < columns.length; j++) {
                const col = columns[j];
                if (col?.match(/[\d,]+/)) {
                  amountColumnIndex = j;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Check if we detected multi-line headers (indicated by descriptionColumnIndex or amountColumnIndex being -1)
    const isMultiLineFormat = descriptionColumnIndex < 0 || amountColumnIndex < 0;

    // If table structure not found, continue to next section
    // For multi-line format, descriptionColumnIndex can be -1 (description is on separate line)
    // For single-line format, we require descriptionColumnIndex >= 0
    // Rule 1: Process tables with description column
    if (headerRowIndex < 0 || dataStartRowIndex < 0) {
      // No table found, move to next section
      currentLineIndex = Math.max(currentLineIndex + 1, headerRowIndex + 1);
      continue;
    }
    if (!isMultiLineFormat && descriptionColumnIndex < 0) {
      // Table found but no description column, skip this table
      currentLineIndex = headerRowIndex + 1;
      continue;
    }

    let tableEndRow = -1;

    // Parse transaction rows from this table
    if (isMultiLineFormat) {
      // Multi-line format: each transaction spans 3 lines (date, description, amounts)
      for (let i = dataStartRowIndex; i < lines.length - 2; i += 3) {
      const dateLine = lines[i]?.trim();
      const descriptionLine = lines[i + 1]?.trim();
      const amountLine = lines[i + 2]?.trim();

      logDebug('Raw transaction row (multi-line format)', {
        dateLine,
        descriptionLine,
        amountLine,
        rowIndex: i,
      });

      // Validate all 3 lines exist
      if (!dateLine || !descriptionLine || !amountLine) {
        continue;
      }

      // Extract date - may contain two dates (transaction date and posting date)
      // Take the first date or split if they're concatenated
      let dateStr: string = dateLine;
      // Check if two dates are concatenated (e.g., "11/11/202514/11/2025")
      const twoDateMatch = dateLine.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/);
      if (twoDateMatch?.[1]) {
        // Use the first date (transaction date)
        dateStr = twoDateMatch[1];
      } else {
        // Try to extract first date from the line using the specified format
        const parsed = parseDateByFormat(dateLine, dateFormat);
        if (parsed) {
          dateStr = parsed;
        }
      }

        // Rule 2: Process rows with date value
        // Only parse rows with valid date information matching the format
        if (!isValidDate(dateStr, dateFormat)) {
          continue;
        }

        // Extract description
        const description = descriptionLine;
        if (!description || description.length < 3) {
          continue;
        }

      // Extract amounts from amount line (format: "         407,800 DR               0 CR")
      // Split by multiple spaces to get debit and credit amounts
      const amountParts = amountLine.split(/\s{2,}/).map((part) => part.trim()).filter((part) => part);

      let debit: number | undefined;
      let credit: number | undefined;

      for (const part of amountParts) {
        // Check if it contains DR (debit)
        if (/DR|DEBIT/i.test(part)) {
          const debitValue = parseFloat(part.replace(/[,\s]|DR|DEBIT/gi, ''));
          if (!isNaN(debitValue) && debitValue > 0) {
            debit = debitValue;
          }
        }
        // Check if it contains CR (credit)
        if (/CR|CREDIT/i.test(part)) {
          const creditValue = parseFloat(part.replace(/[,\s]|CR|CREDIT/gi, ''));
          if (!isNaN(creditValue) && creditValue > 0) {
            credit = creditValue;
          }
        }
      }

      // If no DR/CR indicators, try to parse as numbers
      if (!debit && !credit && amountParts.length > 0) {
        const firstAmountPart = amountParts[0];
        if (firstAmountPart) {
          const firstAmount = parseFloat(firstAmountPart.replace(/[,\s]/g, ''));
          if (!isNaN(firstAmount) && firstAmount > 0) {
            // Assume it's a debit if no indicator
            debit = firstAmount;
          }
        }
      }

      if (!debit && !credit) {
        continue;
      }

        const parsedTransaction: ParsedTransaction = {
          date: dateStr,
          description: description ?? '',
          debit,
          credit,
        };

        // Log row text and parsed result
        const rowText = `${dateLine}\n${descriptionLine}\n${amountLine}`;
        logDebug('Parsed transaction row (multi-line format)', {
          rowText,
          parsedResult: JSON.stringify(parsedTransaction),
          rowIndex: i,
        });

        transactions.push(parsedTransaction);
        tableEndRow = i + 2; // Track end of this transaction
      }
    } else {
      // Single-line format: original logic
      let consecutiveNonDateRows = 0;
      for (let i = dataStartRowIndex; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) {
          consecutiveNonDateRows++;
          // If we hit multiple empty lines, likely end of table
          if (consecutiveNonDateRows >= 3) {
            tableEndRow = i - consecutiveNonDateRows;
            break;
          }
          continue;
        }

        logDebug('Raw transaction row (single-line format)', {
          rowText: line,
          rowIndex: i,
        });

        // Reset counter if we have content
        consecutiveNonDateRows = 0;

        // Check if we've hit a new table header (stop processing this table)
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('transaction date') && lowerLine.includes('description') &&
            (lowerLine.includes('amounts') || lowerLine.includes('debit') ||
             lowerLine.includes('credit') || lowerLine.includes('paid'))) {
          // Found next table header, stop processing this one
          tableEndRow = i;
          break;
        }

        // Split line by multiple spaces or tabs to get columns (same as header)
        const columns = line.split(/\s{2,}|\t/).map((col) => col.trim());

        // Skip if we don't have enough columns
        if (columns.length <= Math.max(dateColumnIndex, descriptionColumnIndex, amountColumnIndex)) {
          consecutiveNonDateRows++;
          continue;
        }

        // Extract date from Transaction date column
        const rawDateStr = columns[dateColumnIndex]?.trim();
        if (!rawDateStr) {
          consecutiveNonDateRows++;
          continue;
        }

        // Parse date according to format
        const dateStr = parseDateByFormat(rawDateStr, dateFormat) || rawDateStr;

        // Rule 2: Process rows with date value
        // Only parse rows with valid date information matching the format
        if (!isValidDate(dateStr, dateFormat)) {
          consecutiveNonDateRows++;
          // If we hit many non-date rows, likely end of table
          if (consecutiveNonDateRows >= 5) {
            tableEndRow = i - consecutiveNonDateRows;
            break;
          }
          continue;
        }

        // Reset counter on valid date row
        consecutiveNonDateRows = 0;

        // Extract description from description column
        const description = columns[descriptionColumnIndex]?.trim() ?? '';
        if (!description) {
          continue;
        }

        // Extract amount from amount column
        const amountStr = columns[amountColumnIndex]?.trim();
        if (!amountStr) {
          continue;
        }

        // Parse amount - remove commas, spaces, and DR/CR suffixes
        const amountValue = parseFloat(amountStr.replace(/[,\s]|DR|CR|DEBIT|CREDIT/gi, ''));

        if (isNaN(amountValue) || amountValue === 0) {
          continue;
        }

        // Determine if it's debit or credit based on column name or suffix
        const headerLine = headerRowIndex >= 0 ? lines[headerRowIndex] : undefined;
        const isDebit = /DR|DEBIT/i.test(amountStr) ||
                        (headerLine?.toLowerCase().includes('debit') ?? false);
        const isCredit = /CR|CREDIT/i.test(amountStr) ||
                         (headerLine?.toLowerCase().includes('credit') ?? false);

        // Create transaction
        let debit: number | undefined;
        let credit: number | undefined;

        if (isDebit) {
          debit = Math.abs(amountValue);
        } else if (isCredit) {
          credit = Math.abs(amountValue);
        } else {
          // No clear indicator, use absolute value as debit
          debit = Math.abs(amountValue);
        }

        const parsedTransaction: ParsedTransaction = {
          date: dateStr,
          description,
          debit,
          credit,
        };

        // Log row text and parsed result
        logDebug('Parsed transaction row (single-line format)', {
          rowText: line,
          parsedResult: JSON.stringify(parsedTransaction),
          rowIndex: i,
        });

        transactions.push(parsedTransaction);
        tableEndRow = i; // Track end of this transaction
      }
    }

    // Move to next position to search for next table
    if (tableEndRow >= 0) {
      currentLineIndex = tableEndRow + 1;
    } else {
      // No more tables found, exit
      break;
    }
  }

  return transactions;
}

/**
 * Parse PDF file and extract card number and transactions
 * @param buffer - PDF file buffer
 * @param dateFormat - Date format to use for parsing (default: DD/MM/YYYY)
 * @returns Parsed PDF data with card number and transactions
 */
export async function parsePDF(buffer: Buffer, dateFormat: string = 'DD/MM/YYYY'): Promise<ParsedPDFData> {
  const data = await pdfParse(buffer);
  const text = data.text;

  // Extract card number
  const cardNumber = extractCardNumber(text);

  // Parse transaction table with date format
  const transactions = parseTransactionTable(text, dateFormat);

  return {
    cardNumber,
    transactions,
  };
}














