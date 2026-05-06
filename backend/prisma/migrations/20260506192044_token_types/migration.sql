/*
  Warnings:

  - Added the required column `kind` to the `api_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('USER', 'PROJECT');

-- AlterTable
ALTER TABLE "api_tokens" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "kind" "TokenKind" NOT NULL;

-- CreateIndex
CREATE INDEX "api_tokens_expires_at_idx" ON "api_tokens"("expires_at");
