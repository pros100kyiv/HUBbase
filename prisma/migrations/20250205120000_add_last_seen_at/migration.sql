-- Add lastSeenAt to ManagementCenter for online/offline page tracking
ALTER TABLE "ManagementCenter" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
