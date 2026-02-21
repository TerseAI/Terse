WITH event_with_uid AS (
SELECT 
  CASE
    WHEN raw_event_json->>'id' IS NOT NULL 
      THEN raw_event_json->>'id'
    WHEN raw_event_json->>'callId' is NOT NULL AND raw_event_json->>'type' IS NOT NULL 
      THEN (raw_event_json->>'type')::text || ':' || (raw_event_json->>'callId'::text)
    WHEN raw_event_json->>'role' = 'user'
      THEN (raw_event_json ->> 'role'::text) || ':' || md5(raw_event_json->>'content'::text) || created_at
    ELSE NULL
  END AS computed_id,
  raw_event_json,
  created_at,
  id
FROM run_history_raw_events
), ordered_event_with_uid AS (
	SELECT 
	id,
	ROW_NUMBER() OVER (PARTITION BY computed_id ORDER BY created_at) as rn
	from event_with_uid
), events_to_remove AS (
    SELECT id FROM ordered_event_with_uid WHERE rn > 1
)
DELETE FROM run_history_raw_events re WHERE re.id IN (SELECT id FROM events_to_remove);