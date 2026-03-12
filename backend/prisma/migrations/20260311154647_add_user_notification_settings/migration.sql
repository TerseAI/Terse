-- Important that we default this, so users get notified on approvals
-- or errors by default
UPDATE automation_notification_settings
SET enabled=true, action_types=ARRAY(
    SELECT DISTINCT x
    FROM unnest(
      COALESCE(action_types, ARRAY[]::"RunHistoryActionType"[])
      || ARRAY['approve', 'error']::"RunHistoryActionType"[]
    ) AS t(x)
  );


-- CreateTable
CREATE TABLE "user_notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_default_notifications" "RunHistoryActionType"[],
    "weekly_agent_improvements" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_settings_user_id_key" ON "user_notification_settings"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_settings_user_id_idx" ON "user_notification_settings"("user_id");

-- AddForeignKey
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
