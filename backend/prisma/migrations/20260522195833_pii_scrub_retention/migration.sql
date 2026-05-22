-- Track when a run had its PII scrubbed (30-day retention)
ALTER TABLE "run_history_records" ADD COLUMN "pii_scrubbed_at" TIMESTAMP(3);

-- Partial index keeps the nightly "find scrub candidates" query cheap as the table grows
CREATE INDEX "run_history_records_scrub_idx"
  ON "run_history_records" ("timestamp")
  WHERE "pii_scrubbed_at" IS NULL;
