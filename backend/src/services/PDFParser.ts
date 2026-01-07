/**
 * PDF Parser Service
 * Extracts transaction data from credit card statement PDFs
 */

// Use legacy build for Node.js environments (avoids DOMMatrix dependency)
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
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
  // Accept both dashes and slashes for formats that use them
  let pattern: RegExp;
  switch (format) {
    case 'DD/MM/YYYY':
      // Accept both DD/MM/YYYY and DD-MM-YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
      break;
    case 'MM/DD/YYYY':
      // Accept both MM/DD/YYYY and MM-DD-YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
      break;
    case 'YYYY-MM-DD':
      pattern = /^(\d{4})-(\d{2})-(\d{2})$/;
      break;
    case 'DD-MM-YYYY':
      // Accept both DD-MM-YYYY and DD/MM/YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
      break;
    case 'MM-DD-YYYY':
      // Accept both MM-DD-YYYY and MM/DD/YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
      break;
    default:
      // Default to DD/MM/YYYY (accept both separators)
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
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
  // Accept both dashes and slashes for formats that use them
  let pattern: RegExp;
  switch (format) {
    case 'DD/MM/YYYY':
      // Accept both DD/MM/YYYY and DD-MM-YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
      break;
    case 'MM/DD/YYYY':
      // Accept both MM/DD/YYYY and MM-DD-YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
      break;
    case 'YYYY-MM-DD':
      pattern = /^(\d{4})-(\d{2})-(\d{2})/;
      break;
    case 'DD-MM-YYYY':
      // Accept both DD-MM-YYYY and DD/MM/YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
      break;
    case 'MM-DD-YYYY':
      // Accept both MM-DD-YYYY and MM/DD/YYYY
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
      break;
    default:
      // Default to DD/MM/YYYY (accept both separators)
      pattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
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

      // Check for amount column (Amount, Debit, Credit, or Paid)
      const hasAmount = line.includes('amount') ||
                       line.includes('debit') ||
                       line.includes('credit') ||
                       line.includes('paid');

      if (hasTransactionDate && hasDescription && hasAmount) {
        // Split line by multiple spaces or tabs to get columns
        const columns = line.split(/\s{2,}|\t/).map((col) => col.trim().toLowerCase());

        // Find column indices
        dateColumnIndex = columns.findIndex((col) => col.includes('transaction date') || col.includes('date'));
        descriptionColumnIndex = columns.findIndex((col) => col.includes('description'));

        // Find amount column (check for Amount, Debit, Credit, or Paid)
        amountColumnIndex = columns.findIndex((col) =>
          col.includes('amount') ||
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

    // If no explicit header found, try to detect table by data pattern
    // Look for lines that start with two dates (DD-MM-YYYY or DD/MM/YYYY format)
    // This handles PDFs without explicit headers but with Date and Description data
    let patternBasedTableFound = false;
    if (headerRowIndex < 0) {
      // Pattern: two dates at start of line (transaction date and posting date)
      // Example: "06-12-2025  06-12-2025  9941  MOCA  40.000"
      const twoDatePattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;

      for (let i = currentLineIndex; i < Math.min(lines.length, currentLineIndex + 200); i++) {
        const line = lines[i]?.trim();
        if (!line) continue;

        // Check if line starts with two dates (pattern for transaction row)
        const match = line.match(twoDatePattern);
        if (match) {
          // Validate first date
          const firstDateStr = `${match[1]}-${match[2]}-${match[3]}`;
          if (isValidDate(firstDateStr, dateFormat)) {
            // Found potential transaction data - treat this as start of table
            headerRowIndex = -1; // No explicit header
            dataStartRowIndex = i;
            patternBasedTableFound = true;
            break;
          }
        }
      }
    }

    // If single-line header not found OR description column not found, try multi-line header detection
    // BUT skip if pattern-based table was already found
    if (!patternBasedTableFound && (headerRowIndex < 0 || descriptionColumnIndex < 0)) {
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
    // If pattern-based table was found, it's a pattern-based detection (no explicit header)
    const isPatternBasedTable = patternBasedTableFound;

    // If table structure not found, continue to next section
    // For multi-line format, descriptionColumnIndex can be -1 (description is on separate line)
    // For single-line format, we require descriptionColumnIndex >= 0
    // Rule 1: Process tables with description column
    if (!isPatternBasedTable) {
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
    }

    let tableEndRow = -1;

    // Parse transaction rows from this table
    if (isPatternBasedTable) {
      // Pattern-based table: parse lines that start with two dates
      // Format: "DD-MM-YYYY  DD-MM-YYYY  [identifier]  [description]  [amount]"
      // Example: "06-12-2025  06-12-2025  9941  MOCA  40.000"
      const twoDatePattern = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;

      for (let i = dataStartRowIndex; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) {
          // Empty line might indicate end of table
          if (tableEndRow < 0) {
            tableEndRow = i - 1;
          }
          continue;
        }

        // Check if line starts with two dates
        const match = line.match(twoDatePattern);
        if (!match) {
          // No more transaction rows
          if (tableEndRow < 0) {
            tableEndRow = i - 1;
          }
          // Check if this looks like a summary line (e.g., "OUTSTANDING BALANCE")
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('balance') || lowerLine.includes('total') || lowerLine.includes('summary')) {
            break;
          }
          continue;
        }

        // Extract first date (transaction date)
        const day1 = parseInt(match[1] ?? '0', 10);
        const month1 = parseInt(match[2] ?? '0', 10);
        const year1 = parseInt(match[3] ?? '0', 10);

        // Build date string in the specified format
        const separator = dateFormat.includes('-') ? '-' : '/';
        let dateStr: string;
        if (dateFormat === 'MM/DD/YYYY' || dateFormat === 'MM-DD-YYYY') {
          dateStr = `${month1.toString().padStart(2, '0')}${separator}${day1.toString().padStart(2, '0')}${separator}${year1}`;
        } else if (dateFormat === 'YYYY-MM-DD') {
          dateStr = `${year1}${separator}${month1.toString().padStart(2, '0')}${separator}${day1.toString().padStart(2, '0')}`;
        } else {
          // DD/MM/YYYY or DD-MM-YYYY (default)
          dateStr = `${day1.toString().padStart(2, '0')}${separator}${month1.toString().padStart(2, '0')}${separator}${year1}`;
        }

        // Validate date
        if (!isValidDate(dateStr, dateFormat)) {
          continue;
        }

        // Extract remaining part after dates: [identifier][description][amount]
        const afterDates = line.substring(match[0]?.length ?? 0).trim();

        // Find amount - PDF format has both DR and CR amounts: "[desc] [DR amount] DR  0 CR" or "[desc]  0 DR  [CR amount] CR"
        // Extract both and use the non-zero one
        let amountStr: string | null = null;
        let isCredit = false;

        // Try to match pattern: [number] DR  [number] CR
        const drCrPattern = /([\d.,]+)\s+DR\s+([\d.,]+)\s+CR$/i;
        const drCrMatch = afterDates.match(drCrPattern);

        if (drCrMatch) {
          const drAmount = drCrMatch[1];
          const crAmount = drCrMatch[2];
          // Use the non-zero amount
          if (drAmount && drAmount !== '0' && !drAmount.match(/^0+[.,]?0*$/)) {
            amountStr = drAmount;
            isCredit = false;
          } else if (crAmount && crAmount !== '0' && !crAmount.match(/^0+[.,]?0*$/)) {
            amountStr = crAmount;
            isCredit = true;
          }
        } else {
          // Fallback: look for number with optional CR/DR suffix
          const suffixMatch = afterDates.match(/\s*(CR|DR|CREDIT|DEBIT)$/i);
          if (suffixMatch) {
            const beforeSuffix = afterDates.substring(0, suffixMatch.index).trim();
            const amountMatch = beforeSuffix.match(/([\d.,]+)\s*$/);
            if (amountMatch?.[1]) {
              amountStr = amountMatch[1];
              isCredit = /CR|CREDIT/i.test(suffixMatch[1]);
            }
          } else {
            // No suffix: take the last number sequence
            const lastNumberMatch = afterDates.match(/([\d.,]+)$/);
            if (lastNumberMatch?.[1] && lastNumberMatch[1].length <= 15) {
              amountStr = lastNumberMatch[1];
            }
          }
        }

        if (!amountStr) continue;

        // Parse amount (handle Vietnamese format: dots as thousand separators)
        const amountValue = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
        if (isNaN(amountValue) || amountValue === 0) continue;

        // Extract description (everything between dates and amount)
        let description: string;
        if (drCrMatch) {
          // For DR/CR format, description is everything before the DR amount
          const drAmountStart = afterDates.indexOf(drCrMatch[1]);
          description = afterDates.substring(0, drAmountStart).trim();
        } else {
          // For other formats, use lastIndexOf to find amount
          const amountStartIndex = afterDates.lastIndexOf(amountStr);
          description = afterDates.substring(0, amountStartIndex).trim();
        }

        // Remove identifier if present (usually 4 digits at start)
        description = description.replace(/^\d{4}\s+/, '').trim();
        if (!description || description.length < 2) continue;

        // Determine debit/credit (already set from amount extraction above)
        const isDebit = !isCredit;

        const parsedTransaction: ParsedTransaction = {
          date: dateStr,
          description,
          debit: isDebit ? amountValue : undefined,
          credit: isCredit ? amountValue : undefined,
        };

        transactions.push(parsedTransaction);
        tableEndRow = i;
      }
    } else if (isMultiLineFormat) {
      // Multi-line format: each transaction spans 3 lines (date, description, amounts)
      // But also check if rows are actually single-line concatenated format
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
            (lowerLine.includes('amount') || lowerLine.includes('debit') ||
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
        const headerLineLower = headerLine?.toLowerCase() ?? '';

        // Get header columns to check the amount column name
        const headerColumns = headerLineLower.split(/\s{2,}|\t/).map((col) => col.trim());
        const rawAmountColumnName = amountColumnIndex >= 0 ? headerColumns[amountColumnIndex] : '';
        const amountColumnName = rawAmountColumnName ?? '';

        // Check if amount column is "Amount" (not "Debit", or "Credit")
        const isAmountColumn = amountColumnName.includes('amount') &&
                               !amountColumnName.includes('debit') &&
                               !amountColumnName.includes('credit');

        // For "Amount" column: treat as credit if value > 0 and has "CR" suffix
        // Otherwise, use standard logic for Debit/Credit columns
        const isDebit = /DR|DEBIT/i.test(amountStr) ||
                        (amountColumnName.includes('debit') && !isAmountColumn) ||
                        (isAmountColumn && /DR/i.test(amountStr));
        const isCredit = /CR|CREDIT/i.test(amountStr) ||
                         (amountColumnName.includes('credit') && !isAmountColumn) ||
                         (isAmountColumn && /CR/i.test(amountStr) && amountValue > 0);

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

  // Also try parsing concatenated single-line format (always run as fallback)
  // Pattern: DD-MM-YYYYDD-MM-YYYY[identifier][description][amount]
  // Example: 06-12-202506-12-20259941MOCA40.000
  // Search entire text for these patterns (they may be embedded in longer lines)

  // Search entire text for concatenated transaction patterns
  // Pattern: two dates concatenated (DD-MM-YYYYDD-MM-YYYY or DD/MM/YYYYDD/MM/YYYY)
  // Accept both dashes and slashes, and match anywhere in the text (not just start of line)
  const concatenatedDatePattern = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g;
  let match;
  const fullText = text;

  while ((match = concatenatedDatePattern.exec(fullText)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + (match[0]?.length ?? 0);

    // Find the line containing this match and extract the full line context
    let lineStart = matchStart;
    while (lineStart > 0 && fullText[lineStart - 1] !== '\n') {
      lineStart--;
    }
    let lineEnd = matchEnd;
    while (lineEnd < fullText.length && fullText[lineEnd] !== '\n') {
      lineEnd++;
    }
    const line = fullText.substring(lineStart, lineEnd).trim();

    // Skip if this line was already parsed as a transaction
    const alreadyParsed = transactions.some((txn) => {
      const txnLine = `${txn.date}${txn.description}${txn.debit ?? txn.credit ?? ''}`;
      return line.includes(txnLine) || txnLine.includes(line.substring(0, 50));
    });
    if (alreadyParsed) continue;

    // Extract first date (transaction date)
    const day1 = parseInt(match[1] ?? '0', 10);
    const month1 = parseInt(match[2] ?? '0', 10);
    const year1 = parseInt(match[3] ?? '0', 10);

    // Build date string in the specified format (use separator from format)
    const separator = dateFormat.includes('-') ? '-' : '/';
    let dateStr: string;
    if (dateFormat === 'MM/DD/YYYY' || dateFormat === 'MM-DD-YYYY') {
      dateStr = `${month1.toString().padStart(2, '0')}${separator}${day1.toString().padStart(2, '0')}${separator}${year1}`;
    } else if (dateFormat === 'YYYY-MM-DD') {
      dateStr = `${year1}${separator}${month1.toString().padStart(2, '0')}${separator}${day1.toString().padStart(2, '0')}`;
    } else {
      // DD/MM/YYYY or DD-MM-YYYY (default)
      dateStr = `${day1.toString().padStart(2, '0')}${separator}${month1.toString().padStart(2, '0')}${separator}${year1}`;
    }

    // Validate date
    if (!isValidDate(dateStr, dateFormat)) {
      continue;
    }

    // Extract remaining part after dates: [identifier][description][amount]
    const afterDates = line.substring(match[0]?.length ?? 0);

    // Find amount at the end - be more precise to avoid matching numbers in description
    // The amount is the number sequence immediately before CR/DR/CREDIT/DEBIT
    // Work backwards from the suffix to find the amount
    let amountStr: string | null = null;

    // Check if line ends with CR/DR/CREDIT/DEBIT
    const suffixMatch = afterDates.match(/\s*(CR|DR|CREDIT|DEBIT)$/i);

    if (suffixMatch) {
      // Find the number sequence immediately before the suffix
      // Look for pattern: [number][optional spaces][CR/DR]
      // The number should be at the end of the string before the suffix
      const beforeSuffix = afterDates.substring(0, suffixMatch.index);
      // Match the last number sequence at the end (may have spaces before it)
      const amountMatch = beforeSuffix.match(/([\d.,]+)\s*$/);
      if (amountMatch?.[1]) {
        let candidateAmount = amountMatch[1];
        // If the matched number is very long, it might be multiple numbers concatenated
        // Try to extract the rightmost reasonable amount (typically ends with .XXX pattern)
        // Example: "11.202514.130" should extract "14.130"
        // Vietnamese amounts are typically [1-3 digits].[3 digits] format
        if (candidateAmount.length > 10) {
          // Strategy: Look for the pattern that's at the END of the string
          // The amount is typically the last [1-3 digits].[3 digits] pattern
          // Find all matches and prefer the longest one that's reasonable

          // Try [1-3 digits].[3 digits] to get all possible matches
          const allMatches = Array.from(candidateAmount.matchAll(/(\d{1,3}\.\d{3})/g));
          if (allMatches.length > 0) {
            // Get the last (rightmost) match
            const lastMatch = allMatches[allMatches.length - 1];
            if (lastMatch?.[1] && lastMatch[1].length <= 8) {
              // Check if there's a shorter match that's also at the end
              // For "11.202514.130", we want "14.130" not "514.130"
              // For "655.989", we want "655.989" not "55.989"
              const lastMatchStr = lastMatch[1];
              const beforeDot = lastMatchStr.split('.')[0];

              // If the last match has 3 digits before dot, check if there's a 1-2 digit match
              // that's also at the end (would indicate concatenated numbers)
              if (beforeDot?.length === 3) {
                const shorterMatch = candidateAmount.match(/(\d{1,2}\.\d{3})$/);
                // Only use shorter match if it's NOT a suffix of the longer match
                // This handles "11.202514.130" -> prefer "14.130" over "514.130"
                // But keeps "655.989" instead of "55.989" (since "55.989" is a suffix of "655.989")
                if (shorterMatch?.[1] && !lastMatchStr.endsWith(shorterMatch[1])) {
                  candidateAmount = shorterMatch[1];
                } else {
                  candidateAmount = lastMatchStr;
                }
              } else {
                candidateAmount = lastMatchStr;
              }
            } else {
              // Fallback: try 1-2 digit pattern
              const last2DigitMatch = candidateAmount.match(/(\d{1,2}\.\d{3})$/);
              if (last2DigitMatch?.[1]) {
                candidateAmount = last2DigitMatch[1];
              }
            }
          } else {
            // Last resort: take the last 6-8 characters (typical amount length)
            candidateAmount = candidateAmount.substring(Math.max(0, candidateAmount.length - 8));
          }
        }
        amountStr = candidateAmount;
      }
    } else {
      // No suffix: take the last number sequence in the line
      const lastNumberMatch = afterDates.match(/([\d.,]+)$/);
      const potentialAmount = lastNumberMatch?.[1];
      // Only accept if it's reasonably sized (not too many digits, suggesting it's not concatenated)
      // Vietnamese amounts typically have 3-6 digits before decimal/thousand separator
      if (potentialAmount && potentialAmount.length <= 15) {
        amountStr = potentialAmount;
      }
    }

    if (!amountStr) continue;

    // Parse amount (replace dots/commas, handle as thousand separators)
    // Vietnamese format uses dots as thousand separators: 40.000 = 40000
    const amountValue = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
    if (isNaN(amountValue) || amountValue === 0) continue;

    // Extract description (everything between dates and amount)
    // Find where the amount starts in the string
    const amountStartIndex = afterDates.lastIndexOf(amountStr);
    const description = afterDates.substring(0, amountStartIndex).trim();
    if (!description || description.length < 2) continue;

    // Determine debit/credit - check the suffix after the amount
    const afterAmount = afterDates.substring(amountStartIndex + amountStr.length);
    const isCredit = /CR|CREDIT/i.test(afterAmount);
    const isDebit = /DR|DEBIT/i.test(afterAmount) || !isCredit;

    const parsedTransaction: ParsedTransaction = {
      date: dateStr,
      description,
      debit: isDebit ? amountValue : undefined,
      credit: isCredit ? amountValue : undefined,
    };

    transactions.push(parsedTransaction);
  }

  return transactions;
}

/**
 * Extract text from PDF using pdfjs-dist
 * Preserves spacing and layout for better table parsing
 * @param buffer - PDF file buffer
 * @returns Extracted text content from all pages
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Load PDF document
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    verbosity: 0, // Suppress warnings
  });
  const pdf = await loadingTask.promise;

  const textParts: string[] = [];
  const numPages = pdf.numPages;

  // Extract text from each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Build text while preserving spacing for table structure
    let pageText = '';
    let lastY = -1;
    let lastX = -1;

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str) {
        continue;
      }

      const transform = item.transform;
      // Type assertion for transform array (pdfjs-dist uses number[])
      const transformArray = transform as number[];
      const x = transformArray[4] ?? 0;
      const y = transformArray[5] ?? 0;

      // If Y position changed significantly, start a new line
      if (lastY >= 0 && Math.abs(y - lastY) > 2) {
        pageText += '\n';
      } else if (lastX >= 0 && x - lastX > 10) {
        // If X position has significant gap, add spaces (likely column separator)
        // Use multiple spaces to preserve column alignment
        const spaces = Math.floor((x - lastX) / 5);
        pageText += ' '.repeat(Math.min(spaces, 20));
      } else if (lastX >= 0 && x < lastX) {
        // X moved backwards, likely a new line or wrapped text
        pageText += ' ';
      } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
        // Add space between words on same line
        pageText += ' ';
      }

      pageText += item.str;
      // Type assertion for width property
      const itemWidth = ('width' in item && typeof item.width === 'number') ? item.width : 0;
      lastX = x + itemWidth;
      lastY = y;
    }

    textParts.push(pageText);
  }

  // Join all pages with newlines
  return textParts.join('\n');
}

/**
 * Parse PDF file and extract card number and transactions
 * @param buffer - PDF file buffer
 * @param dateFormat - Date format to use for parsing (default: DD/MM/YYYY)
 * @returns Parsed PDF data with card number and transactions
 */
export async function parsePDF(buffer: Buffer, dateFormat: string = 'DD/MM/YYYY'): Promise<ParsedPDFData> {
  const text = await extractTextFromPDF(buffer);

  // Extract card number
  const cardNumber = extractCardNumber(text);

  // Parse transaction table with date format
  const transactions = parseTransactionTable(text, dateFormat);

  return {
    cardNumber,
    transactions,
  };
}














