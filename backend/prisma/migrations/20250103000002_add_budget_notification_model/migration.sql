-- CreateTable
CREATE TABLE "BudgetNotification" (
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
CREATE INDEX "BudgetNotification_userId_idx" ON "BudgetNotification"("userId");

-- CreateIndex
CREATE INDEX "BudgetNotification_budgetId_idx" ON "BudgetNotification"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetNotification_userId_read_idx" ON "BudgetNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "BudgetNotification_userId_createdAt_idx" ON "BudgetNotification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BudgetNotification" ADD CONSTRAINT "BudgetNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetNotification" ADD CONSTRAINT "BudgetNotification_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
