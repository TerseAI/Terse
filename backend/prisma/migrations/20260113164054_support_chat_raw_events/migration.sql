-- CreateEnum
CREATE TYPE "ChatSessionType" AS ENUM ('SLACK_THREAD', 'DIRECT_CHAT');

-- CreateTable
CREATE TABLE "chat_raw_events" (
    "id" TEXT NOT NULL,
    "chat_session_id" TEXT NOT NULL,
    "raw_event_json" JSONB NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_raw_events_chat_session_id_idx" ON "chat_raw_events"("chat_session_id");

-- CreateIndex
CREATE INDEX "chat_raw_events_chat_session_id_sequence_order_idx" ON "chat_raw_events"("chat_session_id", "sequence_order");

-- CreateIndex
CREATE INDEX "chat_raw_events_created_at_idx" ON "chat_raw_events"("created_at");
