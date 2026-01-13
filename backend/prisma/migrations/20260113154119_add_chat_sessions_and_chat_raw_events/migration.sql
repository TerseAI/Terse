-- CreateEnum
CREATE TYPE "ChatSessionType" AS ENUM ('SLACK_THREAD', 'DIRECT_CHAT');

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "session_type" "ChatSessionType" NOT NULL,
    "external_id" TEXT NOT NULL,
    "user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "chat_sessions_external_id_idx" ON "chat_sessions"("external_id");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_session_type_idx" ON "chat_sessions"("session_type");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_session_type_external_id_key" ON "chat_sessions"("session_type", "external_id");

-- CreateIndex
CREATE INDEX "chat_raw_events_chat_session_id_idx" ON "chat_raw_events"("chat_session_id");

-- CreateIndex
CREATE INDEX "chat_raw_events_chat_session_id_sequence_order_idx" ON "chat_raw_events"("chat_session_id", "sequence_order");

-- CreateIndex
CREATE INDEX "chat_raw_events_created_at_idx" ON "chat_raw_events"("created_at");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_raw_events" ADD CONSTRAINT "chat_raw_events_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
