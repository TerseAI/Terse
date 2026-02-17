-- CreateEnum
CREATE TYPE "RunHistoryChatEventType" AS ENUM ('TextDelta', 'ToolCall', 'ToolCallComplete', 'ToolApprovalRequest', 'NaturalStop', 'FilterResult');

-- AlterTable: Convert existing TEXT values to the new enum type
ALTER TABLE "run_history_chat_events" 
  ALTER COLUMN "event_type" TYPE "RunHistoryChatEventType" USING "event_type"::"RunHistoryChatEventType";
