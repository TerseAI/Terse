-- CreateTable
CREATE TABLE "processed_gmail_messages" (
    "id" TEXT NOT NULL,
    "gmail_integration_id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "internal_date" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_gmail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_gmail_messages_gmail_integration_id_idx" ON "processed_gmail_messages"("gmail_integration_id");

-- CreateIndex
CREATE INDEX "processed_gmail_messages_processed_at_idx" ON "processed_gmail_messages"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_gmail_messages_gmail_integration_id_gmail_message_key" ON "processed_gmail_messages"("gmail_integration_id", "gmail_message_id");

-- AddForeignKey
ALTER TABLE "processed_gmail_messages" ADD CONSTRAINT "processed_gmail_messages_gmail_integration_id_fkey" FOREIGN KEY ("gmail_integration_id") REFERENCES "gmail_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
