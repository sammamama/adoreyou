/*
  Warnings:

  - You are about to drop the column `photo` on the `gifts` table. All the data in the column will be lost.
  - You are about to drop the column `voiceNote` on the `gifts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "gifts" DROP COLUMN "photo",
DROP COLUMN "voiceNote",
ADD COLUMN     "photoKey" TEXT,
ADD COLUMN     "voiceKey" TEXT;
