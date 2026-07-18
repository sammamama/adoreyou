-- Gift: personal message becomes optional; sender can pick which unlocked
-- track the gift plays (null = the song's selected track).
ALTER TABLE "gifts" ALTER COLUMN "personalMessage" DROP NOT NULL;
ALTER TABLE "gifts" ADD COLUMN "trackIndex" INTEGER;
