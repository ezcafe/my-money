-- CreateTable
CREATE TABLE IF NOT EXISTS "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currentSpent" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "categoryId" TEXT,
    "payeeId" TEXT,
    "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BudgetNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Budget_userId_idx" ON "Budget"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Budget_accountId_idx" ON "Budget"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Budget_categoryId_idx" ON "Budget"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Budget_payeeId_idx" ON "Budget"("payeeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_userId_accountId_categoryId_payeeId_key" ON "Budget"("userId", "accountId", "categoryId", "payeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetNotification_userId_idx" ON "BudgetNotification"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetNotification_budgetId_idx" ON "BudgetNotification"("budgetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetNotification_userId_read_idx" ON "BudgetNotification"("userId", "read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BudgetNotification_userId_createdAt_idx" ON "BudgetNotification"("userId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Budget_userId_fkey'
    ) THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Budget_accountId_fkey'
    ) THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Budget_categoryId_fkey'
    ) THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Budget_payeeId_fkey'
    ) THEN
        ALTER TABLE "Budget" ADD CONSTRAINT "Budget_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BudgetNotification_userId_fkey'
    ) THEN
        ALTER TABLE "BudgetNotification" ADD CONSTRAINT "BudgetNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BudgetNotification_budgetId_fkey'
    ) THEN
        ALTER TABLE "BudgetNotification" ADD CONSTRAINT "BudgetNotification_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

