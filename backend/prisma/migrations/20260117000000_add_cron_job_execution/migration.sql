-- CreateTable
CREATE TABLE "CronJobExecution" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "lastRunDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJobExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronJobExecution_jobName_key" ON "CronJobExecution"("jobName");

-- CreateIndex
CREATE INDEX "CronJobExecution_jobName_idx" ON "CronJobExecution"("jobName");
