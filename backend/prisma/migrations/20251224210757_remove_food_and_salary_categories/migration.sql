-- Remove food and salary categories from database
-- This will set categoryId to NULL in transactions and recurring transactions
-- due to onDelete: SetNull constraint
-- Import match rules referencing these categories will be deleted
-- due to onDelete: Cascade constraint

DELETE FROM "Category" 
WHERE LOWER(name) IN ('food', 'salary');

