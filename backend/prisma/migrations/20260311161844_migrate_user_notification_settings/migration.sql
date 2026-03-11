-- Backfill: create default user_notification_settings for every existing user
-- Defaults: error-only notifications, opted in to weekly agent improvement emails
INSERT INTO "user_notification_settings" ("id", "user_id", "agent_default_notifications", "weekly_agent_improvements", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    u."id",
    ARRAY['error']::"RunHistoryActionType"[],
    true,
    NOW(),
    NOW()
FROM "users" u
WHERE NOT EXISTS (
    SELECT 1 FROM "user_notification_settings" uns WHERE uns."user_id" = u."id"
);
