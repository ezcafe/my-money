/*
  Warnings:

  - You are about to drop the column `icon` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `Payee` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "icon";

-- AlterTable
ALTER TABLE "Payee" DROP COLUMN "icon";
