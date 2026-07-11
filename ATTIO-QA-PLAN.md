# Attio Integration QA Plan

Input for a manual QA session driven by a coding agent. Covers the target toolbox (TER-628 scope, decided 2026-07-10) plus the TER-606 codegen fixes. Do not commit this file.

## Preconditions

- A dedicated Attio test workspace (never the production CRM), OAuth-connected to a Terse dev org.
- The Attio developer app must have these scopes (set in the Attio developer dashboard, then reconnect the integration): `record_permission:read-write`, `object_configuration:read-write`, `user_management:read`, `task:read-write`, `note:read-write`, `comment:read-write`, `list_configuration:read-write`, `list_entry:read-write`, `meeting:read`, `call_recording:read`, `file:read-write`, `webhook:read-write`. A 403 on any op means scope config, not code.
- Test fixtures created up front in the workspace: 3 companies, 3 people, 2 deals (one per pipeline stage family), 1 custom object with a status attribute + a multiselect attribute, 1 list over companies with a stage attribute, 2 workspace members.
- `terse generate` run AFTER fixtures exist, so option constants and object types reflect the workspace.
- One throwaway workflow project per resource group, deployed via `terse deploy`, exercised via `terse test run`.

## Ground rules

- Every op gets: one happy path, one invalid-input path (bad slug / bad id / malformed value), and one ACL path where applicable.
- After every write, verify by reading back through the API (not just the tool's success response) and, where a trigger exists, confirm the corresponding webhook event fires into a trigger-test workflow.
- Record every raw API error body verbatim; mismatches between generated types and runtime shapes are P0 findings (regression class of TER-627).
- File findings in Linear, one issue per defect, referencing the matrix row.

## Matrix 1 — Records (`attio_records`)

| # | Action | Case | Expect |
|---|--------|------|--------|
| R1 | create | Create a deal with only required attributes | Succeeds WITHOUT any unique writable attribute (the TER-606 acute bug) |
| R2 | create | Unknown select option in payload | Rejected client-side BEFORE the API call, error names the attribute and the valid options |
| R3 | create | Write to a protected attribute (`record_id`) | Rejected client-side, error names the constraint |
| R4 | get | Get by record_id | Full record; status/select values arrive flattened as `AttioSelectOption` (TER-627 regression check) |
| R5 | get | Nonexistent record_id | Clean typed error, not a crash |
| R6 | update | Patch one attribute, append mode on multiselect | Existing multiselect values preserved, new value appended |
| R7 | update | Same patch, overwrite mode (default) | Multiselect replaced entirely |
| R8 | upsert | Match on non-unique attribute | Rejected client-side, error says the matching attribute must be unique |
| R9 | upsert | Existing record matched | Updates in place, no duplicate created |
| R10 | delete | Delete a record with `toolApprovals: ["attio_records"]` configured | Approval prompt fires; on approve, record gone; `record.deleted` webhook fires |
| R11 | delete | Delete without `attio_records` in toolApprovals | No prompt, delete executes immediately (approval is opt-in by design) |
| R12 | query | `limit=500, offset=0` then `offset=500` on a seeded 600-record object | Two pages, no overlap, no gap; limit >500 clamped |
| R13 | query | Filter with `$contains` + `$or` | Correct subset |
| R14 | search | Fuzzy search by partial company domain | Finds the fixture company |
| R15 | history | Attribute-value history on a deal stage that changed | Ordered stage transitions returned (GTM-016 dependency) |
| R16 | (types) | Write actor reference as plain email string; write record reference as single object AND as array | Both compile against generated types with zero casts and both succeed (TER-606 honest-unions check) |

## Matrix 2 — Tasks (`attio_tasks`)

| # | Action | Case | Expect |
|---|--------|------|--------|
| T1 | create | Task linked to a record, assignee = workspace member, due in 48h | Created; `task.created` webhook fires |
| T2 | list | Filter by linked record | Only that record's tasks |
| T3 | update | Mark complete | `is_completed` true on read-back |
| T4 | create | Invalid assignee id | Clean typed error |

## Matrix 3 — Notes (`attio_notes`)

| # | Action | Case | Expect |
|---|--------|------|--------|
| N1 | create | Note on a company (markdown body) | Renders in Attio UI; `note.created` fires |
| N2 | list | Notes for one record vs all | Correct scoping |
| N3 | delete | Delete note | Approval-gated only when the workflow opts in via toolApprovals |

## Matrix 4 — Lists & entries (`attio_lists`)

| # | Action | Case | Expect |
|---|--------|------|--------|
| L1 | entries.add | Add fixture company to list | Entry created; `list-entry.created` fires (GTM-006/111 trigger path) |
| L2 | entries.update | Change entry stage attribute | Stage updated (the op `upsertRecord` could never express) |
| L3 | entries.query | Paginate entries | Same contract as R12 |
| L4 | entries.remove | Remove entry | Executes without prompt unless gated via toolApprovals; record itself untouched |
| L5 | create list | New list over people | No default gate (schema mutation; gate via toolApprovals if desired) |

## Matrix 5 — Workspace members (`attio_workspace_members`)

| # | Case | Expect |
|---|------|--------|
| W1 | List members | Emails + ids present, enough to join to Slack `lookupByEmail` (the 16/25 GTM blocker: verify an owner actor value on a record can be resolved to a member email end-to-end) |
| W2 | Get by member id from a record's `owner` actor reference | Resolves; document the exact join path for workflow authors |

## Matrix 6 — Comments & threads, meetings, files (`attio_comments`, `attio_meetings`, `attio_files`)

| # | Case | Expect |
|---|------|--------|
| C1 | Create comment on a record, read thread back | Round-trips; `comment.created` fires |
| M1 | List meetings; get recording + transcript on a workspace with at least one synced meeting | Read-only ops return typed shapes (skip gracefully if the test workspace has no meeting data — note it as NOT COVERED, don't fake it) |
| F1 | Upload a small file to a record, list, download | Byte-identical round trip |
| F2 | Delete file | Executes without prompt unless gated via toolApprovals |

## Matrix 7 — Schema/metadata writes (`attio_schema` or equivalent)

| # | Case | Expect |
|---|------|--------|
| S1 | Add a select option to the custom object's attribute | Option visible in Attio UI; rerunning `terse generate` picks it up as a new constant |
| S2 | Create a new attribute on the custom object | Appears in `list objects` output |
| S3 | Stale-codegen check: add an option in Attio UI, do NOT regenerate, write it from a workflow | Compile error (literal-union strictness working as designed); regenerate clears it |

## Matrix 8 — Codegen & cutover (TER-606)

| # | Case | Expect |
|---|------|--------|
| G1 | Generated file contains option constants for every status/select attribute (e.g. `AttioDealStage.Lead`) | Present, values match workspace |
| G2 | Old tool names (`attio_list_objects`, `attio_query_records`, `attio_upsert_record`) | GONE from toolbox and generated types (hard cutover); calling them fails loudly at generate time, not run time |
| G3 | A pre-cutover workflow regenerated against the new surface | Compiles after mechanical rename only |
| G4 | Full write of a deal (status, currency, actor ref, record ref, multiselect) | Zero `as` casts required end-to-end |

## Known-risk areas to probe opportunistically

- Rate limiting: the per-object attribute fan-out in `list objects` on a workspace with 20+ objects (existing N+1, `listObjects.ts:48`). Watch for 429s.
- Token lifecycle: `refreshToken()` returns false; if any 401 appears mid-session, capture it — that's the silent-breakage risk.
- Trigger/tool filter grammar mismatch: tool filters use Attio's native JSON, trigger filters use `{field, operator, value}`; confirm docs/skills don't conflate them.
- Currency and personal-name read shapes (the unfixed half of TER-627's report): query a deal `value` and a person `name`, compare runtime shape to generated type.
- `get_attribute_history` uses `show_historic=true`, which Attio rejects with a 400 on COMINT and enriched attributes; verify the error surfaces cleanly.
- Workspace-member ops need the `user_management:read` scope, configured on the Attio app in the developer dashboard (not in our OAuth URL); a 403 here means the app config needs updating + integration reconnect.

## Exit criteria

Every matrix row PASS, FAIL (with Linear issue), or NOT COVERED (with reason). No row silently skipped.
