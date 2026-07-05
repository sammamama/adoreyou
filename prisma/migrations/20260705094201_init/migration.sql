-- CreateEnum
CREATE TYPE "SongStatus" AS ENUM ('generating', 'preview', 'paid', 'done', 'failed');

-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "stripeEmail" TEXT,
    "recipientName" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "promptInputs" JSONB NOT NULL,
    "styleInputs" JSONB NOT NULL,
    "lyrics" TEXT NOT NULL,
    "sunoTaskId" TEXT,
    "tracks" JSONB NOT NULL DEFAULT '[]',
    "selectedTrackId" TEXT,
    "status" "SongStatus" NOT NULL DEFAULT 'generating',
    "giftCredits" INTEGER NOT NULL DEFAULT 1,
    "upsells" JSONB NOT NULL DEFAULT '{}',
    "amountPaid" INTEGER,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "senderName" TEXT NOT NULL,
    "personalMessage" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_codes_email_idx" ON "login_codes"("email");

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
