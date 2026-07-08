-- AlterTable
ALTER TABLE "gifts" ADD COLUMN     "deliverAt" TIMESTAMP(3),
ADD COLUMN     "photo" BYTEA,
ADD COLUMN     "photoMime" TEXT,
ADD COLUMN     "voiceMime" TEXT,
ADD COLUMN     "voiceNote" BYTEA;
