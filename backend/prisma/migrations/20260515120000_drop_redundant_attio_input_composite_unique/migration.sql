-- Redundant with automation_attio_input_configs_automation_input_id_key:
-- automation_input_id is already unique, so (automation_input_id, webhook_id) adds no constraint.
DROP INDEX IF EXISTS "automation_attio_input_configs_automation_input_id_webhook__key";
