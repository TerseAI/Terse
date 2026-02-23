-- Add enum values in a dedicated migration so they are committed
-- before any subsequent migration uses them.
ALTER TYPE "OutputConfigType" ADD VALUE IF NOT EXISTS 'GITHUB';
ALTER TYPE "OutputConfigType" ADD VALUE IF NOT EXISTS 'POSTHOG';
ALTER TYPE "OutputConfigType" ADD VALUE IF NOT EXISTS 'LAUNCHDARKLY';
ALTER TYPE "OutputConfigType" ADD VALUE IF NOT EXISTS 'DATADOG';
ALTER TYPE "OutputConfigType" ADD VALUE IF NOT EXISTS 'WORKOS';
