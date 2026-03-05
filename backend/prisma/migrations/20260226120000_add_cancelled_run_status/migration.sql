-- Add first-class cancelled status for run history
ALTER TYPE "RunHistoryStatus" ADD VALUE IF NOT EXISTS 'cancelled';
