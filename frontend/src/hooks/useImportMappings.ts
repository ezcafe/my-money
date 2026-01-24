/**
 * Import Mappings Hook
 * Manages description mappings and card number mapping for import transactions
 */

import { useState, useEffect, useMemo } from 'react';
import { useAccounts } from './useAccounts';
import { useCategories } from './useCategories';
import { usePayees } from './usePayees';

/**
 * Unmapped transaction type
 */
export interface UnmappedTransaction {
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
}

/**
 * Description mapping state
 */
export interface DescriptionMapping {
  description: string;
  accountId: string;
  categoryId: string;
  payeeId: string;
}

/**
 * Import mappings hook return type
 */
export interface UseImportMappingsReturn {
  descriptionMappings: Map<string, DescriptionMapping>;
  cardNumber: string | null;
  cardAccountId: string;
  setDescriptionMapping: (
    description: string,
    field: keyof DescriptionMapping,
    value: string
  ) => void;
  setCardAccountId: (accountId: string) => void;
  uniqueDescriptions: string[];
  validateMappings: () => string[];
}

/**
 * Hook for managing import transaction mappings
 * @param unmappedTransactions - Array of unmapped transactions
 * @returns Mapping state and handlers
 */
export function useImportMappings(
  unmappedTransactions: UnmappedTransaction[]
): UseImportMappingsReturn {
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { payees } = usePayees();

  const [descriptionMappings, setDescriptionMappings] = useState<Map<string, DescriptionMapping>>(
    new Map()
  );
  const [cardNumber, setCardNumber] = useState<string | null>(null);
  const [cardAccountId, setCardAccountId] = useState<string>('');

  // Group transactions by unique description
  const uniqueDescriptions = useMemo(() => {
    const descriptions = new Set<string>();
    for (const txn of unmappedTransactions) {
      descriptions.add(txn.rawDescription);
    }
    return Array.from(descriptions);
  }, [unmappedTransactions]);

  // Initialize mappings when unmapped transactions are loaded
  useEffect(() => {
    if (unmappedTransactions.length > 0) {
      // Set card number from first transaction
      const firstCardNumber = unmappedTransactions[0]?.cardNumber;
      if (firstCardNumber) {
        setCardNumber(firstCardNumber);
      }

      // Initialize description mappings
      const newMappings = new Map<string, DescriptionMapping>();
      for (const desc of uniqueDescriptions) {
        // Find first transaction with this description for suggested values
        const firstTxn = unmappedTransactions.find((txn) => txn.rawDescription === desc);
        if (firstTxn && !newMappings.has(desc)) {
          // Determine default categories (Salary for income, Food & Groceries for expense)
          const defaultIncomeCategory = categories.find(
            (category) => category.isDefault && category.categoryType === 'Income'
          );

          const defaultExpenseCategory = categories.find(
            (category) => category.isDefault && category.categoryType === 'Expense'
          );

          // Determine initial category based on transaction type
          const isCredit = firstTxn.rawCredit !== null && firstTxn.rawCredit !== 0;

          let initialCategoryId = firstTxn.suggestedCategoryId ?? '';

          if (!initialCategoryId) {
            if (isCredit && defaultIncomeCategory) {
              // For credit transactions, prefer default income category (Salary)
              initialCategoryId = defaultIncomeCategory.id;
            } else if (!isCredit && defaultExpenseCategory) {
              // For non-credit transactions, prefer default expense category (Food & Groceries) when available
              initialCategoryId = defaultExpenseCategory.id;
            } else if (categories[0]?.id) {
              // Fallback to the first available category
              initialCategoryId = categories[0].id;
            }
          }

          newMappings.set(desc, {
            description: desc,
            accountId: firstTxn.suggestedAccountId ?? accounts[0]?.id ?? '',
            categoryId: initialCategoryId,
            payeeId: firstTxn.suggestedPayeeId ?? payees[0]?.id ?? '',
          });
        }
      }
      setDescriptionMappings(newMappings);

      // Set card account from first transaction's suggested account
      if (unmappedTransactions[0]?.suggestedAccountId) {
        setCardAccountId(unmappedTransactions[0].suggestedAccountId);
      } else if (accounts[0]?.id) {
        setCardAccountId(accounts[0].id);
      }
    } else {
      // Clear mappings when no unmapped transactions
      setDescriptionMappings(new Map());
      setCardNumber(null);
      setCardAccountId('');
    }
  }, [unmappedTransactions, uniqueDescriptions, accounts, categories, payees]);

  /**
   * Update a description mapping field
   */
  const setDescriptionMapping = (
    description: string,
    field: keyof DescriptionMapping,
    value: string
  ): void => {
    const mapping = descriptionMappings.get(description);
    if (!mapping) return;

    const updated = { ...mapping, [field]: value };
    setDescriptionMappings(new Map(descriptionMappings.set(description, updated)));
  };

  /**
   * Validate all mappings
   * @returns Array of error messages
   */
  const validateMappings = (): string[] => {
    const errors: string[] = [];

    // Validate card number mapping if card number exists
    if (cardNumber && !cardAccountId) {
      errors.push('Please select an account for the card number');
    }

    // Validate all description mappings
    for (const [desc, mapping] of descriptionMappings.entries()) {
      if (!mapping.accountId) {
        errors.push(`Account is required for description: ${desc}`);
      }
    }

    return errors;
  };

  return {
    descriptionMappings,
    cardNumber,
    cardAccountId,
    setDescriptionMapping,
    setCardAccountId,
    uniqueDescriptions,
    validateMappings,
  };
}
