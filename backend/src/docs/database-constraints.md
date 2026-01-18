# Database Constraints Documentation

## Overview

Database constraints are enforced at the database level via migrations. Prisma does not support CHECK constraints directly in the schema file, so all constraints are defined in migration files.

## Constraints Defined

### Account Table
- `Account_balance_check`: `balance >= 0` - Ensures account balance is never negative

### Transaction Table
- `Transaction_value_check`: `value != 0` - Ensures transaction value is never zero

### Budget Table
- `Budget_amount_check`: `amount > 0` - Ensures budget amount is positive
- `Budget_currentSpent_check`: `currentSpent >= 0` - Ensures current spent is never negative

### RecurringTransaction Table
- `RecurringTransaction_value_check`: `value != 0` - Ensures recurring transaction value is never zero

### BudgetNotification Table
- `BudgetNotification_threshold_check`: `threshold >= 0 AND threshold <= 100` - Ensures threshold is between 0 and 100

## Foreign Key Constraints

All foreign key constraints are defined in the Prisma schema using `@relation` directives with appropriate `onDelete` and `onUpdate` behaviors.

## Unique Constraints

Unique constraints are defined in the Prisma schema using `@@unique` directives.

## Indexes

Indexes are defined in the Prisma schema using `@@index` directives.

## Migration Files

All constraints are applied via migration files:
- `20260118000002_add_database_constraints/migration.sql` - CHECK constraints
- `20260118055133_add_workspace_system/migration.sql` - Foreign key constraints
