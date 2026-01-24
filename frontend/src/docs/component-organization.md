# Component Organization

## Current Structure

Components are organized by type:

- `components/common/` - Shared components
- `components/ui/` - UI components
- `pages/` - Page components

## Recommended Feature-Based Organization

For large features, consider feature-based organization:

```
components/
  accounts/
    AccountList.tsx
    AccountCard.tsx
    AccountForm.tsx
    AccountDetails.tsx
    index.ts
  transactions/
    TransactionList.tsx
    TransactionCard.tsx
    TransactionForm.tsx
    TransactionDetails.tsx
    index.ts
  budgets/
    BudgetList.tsx
    BudgetCard.tsx
    BudgetForm.tsx
    BudgetDetails.tsx
    index.ts
```

## Benefits

1. **Co-location**: Related files are together
2. **Easier Navigation**: Find all feature files in one place
3. **Better Encapsulation**: Features are self-contained
4. **Easier Refactoring**: Move entire features easily

## Migration Strategy

1. Start with new features using feature-based structure
2. Gradually migrate existing features
3. Keep shared components in `components/common/`
