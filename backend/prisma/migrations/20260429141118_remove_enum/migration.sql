/*
  Warnings:

  - The values [ToolCallGenerating] on the enum `RunHistoryChatEventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RunHistoryChatEventType_new" AS ENUM ('TextDelta', 'ToolCall', 'ToolCallComplete', 'ToolApprovalRequest', 'NaturalStop', 'FilterResult', 'UserMessage', 'Thinking', 'ToolApprovalResponse', 'Snippet', 'RunError');
ALTER TYPE "RunHistoryChatEventType" RENAME TO "RunHistoryChatEventType_old";
ALTER TYPE "RunHistoryChatEventType_new" RENAME TO "RunHistoryChatEventType";
DROP TYPE "public"."RunHistoryChatEventType_old";
COMMIT;
