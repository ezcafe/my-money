/**
 * PDF Parser Service
 * Extracts transaction data from credit card statement PDFs
 */

import pdfParse from 'pdf-parse';

export interface ParsedTransaction {
  date: string;
  description: string;
  debit?: number;
  credit?: number;
}

/**
 * Parse PDF file and extract transactions
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedTransaction[]> {
  const data = await pdfParse(buffer);
  const text = data.text;

  // Basic parsing logic - this would need to be enhanced based on actual PDF format
  const lines = text.split('\n');
  const transactions: ParsedTransaction[] = [];

  // Simple regex patterns (would need to be customized for actual PDF format)
  const datePattern = /\d{2}\/\d{2}\/\d{4}/;
  const amountPattern = /\$?[\d,]+\.\d{2}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      const date = dateMatch[0];
      const amountMatches = line.match(amountPattern);
      
      if (amountMatches) {
        const amount = parseFloat(amountMatches[0].replace(/[$,]/g, ''));
        const description = line.replace(datePattern, '').replace(amountPattern, '').trim();

        transactions.push({
          date,
          description,
          debit: amount > 0 ? amount : undefined,
          credit: amount < 0 ? Math.abs(amount) : undefined,
        });
      }
    }
  }

  return transactions;
}








