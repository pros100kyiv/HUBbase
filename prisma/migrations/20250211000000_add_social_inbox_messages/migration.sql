-- CreateTable
CREATE TABLE "social_inbox_messages" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "externalId" TEXT,
    "externalChatId" TEXT,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_inbox_messages_businessId_idx" ON "social_inbox_messages"("businessId");

-- CreateIndex
CREATE INDEX "social_inbox_messages_businessId_platform_idx" ON "social_inbox_messages"("businessId", "platform");

-- CreateIndex
CREATE INDEX "social_inbox_messages_createdAt_idx" ON "social_inbox_messages"("createdAt");

-- CreateIndex
CREATE INDEX "social_inbox_messages_isRead_idx" ON "social_inbox_messages"("isRead");

-- AddForeignKey
ALTER TABLE "social_inbox_messages" ADD CONSTRAINT "social_inbox_messages_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
