# Attio QA Scenarios — real use cases, full coverage

Seven template-grade automations adapted from AutomationBench GTM use cases (HubSpot/Salesforce read as Attio). Each section has: the **prompt** you give a builder agent verbatim (`terse create`), the **situations** it represents, the **Attio coverage** it exercises, and a **QA checklist** a human verifies after a run. Slack runs through the real integration; everything else third-party (enrichment, call transcripts, signal feeds, email sends) is mocked with constants and `states:`. Together the seven cover **all 56 actions across the 9 Attio tools** (matrix at the end). Run 1 → 7; later scenarios reuse earlier data. Prefix created data `QA_` while testing.

---

## S1 — Inbound Lead Triage & Round-Robin Routing (Flow 1)
*Lineage: GTM-001, GTM-003 · Trigger: webhook (form submission)*

**Prompt:**
> When a prospect submits the website form, enrich the lead with firmographic data, have an agent score and tier it, dedupe it against the CRM, create or update the person and their company in Attio, route it to the next sales owner round-robin, create the deal in the right pipeline stage with that owner assigned, and announce the new lead in Slack with a link to the deal.
>
> Mock the form payload as the webhook sample event and the enrichment provider as a constant. Keep the round-robin pointer in workflow state. Before writing, discover the workspace's objects and confirm the pipeline stages so the deal is created with a valid stage.

**Situations covered:** inbound lead capture, dedupe-before-create, firmographic enrichment, ownership assignment without a human dispatcher, instant team visibility.

**Attio coverage:** `schema.list_objects`, `schema.list_statuses` · `records.search` (dedupe), `records.upsert` ×2 (person by email, company by domain), `records.create` (deal with stage constant + owner email + company reference), `records.get` (read-back) · `workspace_members.list` + `get` (round-robin, owner resolution) · cross-cutting: generated `AttioDealStage` constants, actor-reference email write, flattened `AttioSelectOption` read, owner→Slack join by email.

**QA checklist:** person/company/deal exist in Attio with correct stage and owner; rerun with same payload updates rather than duplicates; owner rotates between runs; Slack message links the actual deal URL; zero casts in the generated code.

**Open search question (verify explicitly):** searchRecords returned zero matches for "QA_Acme Robotics — Website lead" against an existing deal named "Acme Robotics — Website lead". Attio docs say matching follows the in-product strategy (record labels on deals) and is eventually consistent. QA three cases against a deal created >1 minute earlier: (a) exact label, (b) distinctive substring ("Acme Robotics"), (c) label with an extra leading token ("QA_..."). Expected: a and b match; if b fails too, that's a bug to escalate; if only c fails, document "no extra tokens" as the search contract (tool descriptions already say this).

## S2 — CRM Hygiene: Stale Deals & Duplicate Merge (Flow 5)
*Lineage: GTM-010, GTM-015, GTM-042 · Trigger: cron (weekly)*

**Prompt:**
> Weekly, sweep every open deal in the CRM: flag deals whose stage hasn't changed in 14 days (checking the stage's actual change history, not just a timestamp field), create a follow-up task for each stale deal's owner unless one is already open, and DM each owner in Slack with their stale list. In the same sweep, detect duplicate deals by name, merge each pair by copying any missing values onto the older record and deleting the duplicate, and include a merge report in the digest.
>
> The deal set may exceed one page, so paginate the full scan. Track last-sweep results in workflow state to avoid repeat nagging. You may need to create deals in different states to QA this e2e.

**Situations covered:** pipeline hygiene at scale (beyond page one), stale-deal nudges that respect existing tasks, duplicate cleanup where the CRM has no native merge API, manager-grade digests.

**Attio coverage:** `records.query` (limit/offset pagination + filtered query), `records.get_attribute_history` (stage history), `records.update`, `records.delete` (pseudo-merge), `records.create` (seed a QA_dupe to merge) · `tasks.create`, `tasks.list` (open-task dedupe) · `workspace_members.list` · cross-cutting: pagination contract, delete-by-id, normalized error surfaces.

**QA checklist:** scan visits every deal (verify count vs Attio UI); stale detection cites real stage-history dates; no duplicate follow-up task on rerun; the duplicate deal is gone and the survivor gained its values; owners got DMs.

## S3 — Call Notes to CRM (MEDDIC) (FLOW 3)
*Lineage: GTM-011 · Trigger: webhook (call-ended event)*

**Prompt:**
> When a sales call ends, extract MEDDIC fields and action items from the transcript, update the deal's qualification fields, append any competitors mentioned to the deal's competitor list without erasing ones already tracked, replace the deal's previous auto-generated call summary note with a fresh one so there is always exactly one current summary, create a task per action item assigned to the deal owner, and open a comment thread on the deal summarizing what changed for the team. If Attio has the meeting synced, pull its recording transcript instead of the webhook payload.
>
> Mock the call-ended payload (deal ID + transcript text) as the webhook sample event.

**Situations covered:** post-call CRM writeback, multiselect data that accumulates instead of overwriting, self-cleaning generated content, action-item capture, meeting-intelligence when available with graceful fallback.

**Attio coverage:** `records.get`, `records.update` overwrite mode (MEDDIC fields) **and** append mode (competitors multiselect) · `notes.list` + `notes.delete` (replace old summary) + `notes.create` · `tasks.create` · `comments.create` (new record thread) · `meetings.list`, `meetings.get`, `meetings.list_recordings`, `meetings.get_transcript` (log NOT COVERED if the workspace has no synced meetings — don't fake it).

**QA checklist:** MEDDIC fields updated; competitors appended (prior values intact); exactly one summary note after two runs; tasks assigned to owner; thread visible on the deal; meetings branch either ran or logged NOT COVERED.

## S4 — Big-Deal War Room & Loss-Reason Miner
*Lineage: GTM-009, GTM-013 · Trigger: Attio `record.updated` on deals*

**Prompt:**
> When a deal's stage changes: if it entered a late stage, spin up a war room — post the deal brief to Slack and reply on the deal's existing comment thread with next steps tagging context for the owner; if it moved to Lost, mine the deal's notes and comment threads for the real loss reason, write that reason back onto the deal, mark the deal's open tasks complete, delete the bot's now-stale war-room status comment, and clear any leftover QA follow-up tasks.
>
> Fire the trigger by moving the S1 deal's stage in the Attio UI. Verify the trigger payload arrives with readable values (stage as an option object, not a raw envelope).

**Situations covered:** CRM-event-driven orchestration, escalation on high-signal transitions, closed-lost forensics from unstructured activity, cleanup discipline so automations don't litter the CRM.

**Attio coverage:** **Attio trigger end-to-end + event value flattening** · `records.get`, `records.update` · `workspace_members.get` (owner from actor ref) · `comments.list_threads`, `comments.get_thread`, `comments.create` (threadId reply), `comments.get`, `comments.delete` · `notes.list`, `notes.get` · `tasks.list`, `tasks.get`, `tasks.update` (complete), `tasks.delete`.

**QA checklist:** run started from the UI stage change; payload stage was a flattened option; reply landed on S3's thread (not a new one); on Lost: loss reason written, tasks completed then removed, stale comment gone; Slack post rendered the brief.

## S5 — Outbound Campaign List Sequencer
*Lineage: GTM-006, GTM-029, GTM-111, GTM-114 · Trigger: cron (daily)*

**Prompt:**
> Maintain a "QA_Q3 outbound" campaign list of target companies: each day, take the accounts surfaced by the signal feed, ensure each company is on the list exactly once no matter how often it's surfaced, write a research brief note on companies newly added, advance each entry's outreach stage as connection acceptances arrive, and remove companies from the list the moment they reply — without touching the company records themselves. Create the list (with an outreach-stage attribute) on first run and rename it if the quarter's theme changes.
>
> Mock the signal feed, acceptances and replies as constants rotated through workflow state across runs.

**Situations covered:** list-based sequencing (the pattern plain record upserts can't express), idempotent audience membership, per-entry pipeline stages independent of record fields, sequence exit conditions, audience sync hygiene.

**Attio coverage:** all ten `attio_lists` actions — `create`, `list`, `get`, `update`, `add_entry`, `upsert_entry` (idempotence), `query_entries` (pagination), `get_entry`, `update_entry` (stage), `remove_entry` · `schema.create_attribute` on a list (`target: "lists"`) · `notes.create`, `notes.list` · `records.get` (company survives removal).

**QA checklist:** second run adds no duplicate entries; entry stage advances; replied company is off the list but intact as a record; briefs only on newly added companies; list renamed on theme change.

## S6 — Proposal Vault on the Deal
*Lineage: GTM-107, GTM-110 · Trigger: Attio `record.updated` on deals (or cron scan fallback)*

**Prompt:**
> When a deal reaches the proposal stage, generate the proposal document from the deal's data, attach it to the deal record in the CRM, verify it's retrievable, share a download link with the team in Slack, and replace any older proposal versions on the record so the deal always carries exactly one current proposal.
>
> Mock document generation as a constant text body; version it with a counter in workflow state.

**Situations covered:** deal-stage document workflows, the CRM as single source of truth for artifacts, version discipline (no stale attachments), link-based sharing.

**Attio coverage:** `files.upload` (base64), `files.list`, `files.get`, `files.get_download_url` (fetch the URL and confirm content round-trips), `files.delete` (supersede old versions) · `records.query`/`get`.

**QA checklist:** file visible on the deal in the Attio UI; downloaded bytes match the generated body; after two runs exactly one proposal remains; Slack got a working link.

## S7 — CRM Provisioning Copilot
*Lineage: GTM-115 (pre-flight schema checks) + onboarding provisioning · Trigger: manual/cron (run twice)*

**Prompt:**
> Provision the CRM for a new team methodology from a config: ensure a "QA Partnerships" custom object exists (create it if not, fixing its plural label), add the tracking attributes the config calls for — a partnership-stage status attribute and a multi-select tags attribute — retitle attributes whose labels drifted from the config, sync the stage set (add missing stages, rename drifted ones, archive retired ones) and the tag options likewise, then create a first partnership record using the new schema and read it back to confirm the CRM is ready. Report every schema change made, and make rerunning with the same config a no-op.
>
> Mock the methodology config as a constant. After the first run, rerun `terse generate` and confirm the new object and its stage constants appear in the generated types.

**Situations covered:** CRM setup/onboarding automation, config-drift reconciliation, schema evolution without clicking through the UI, the generate→typed-write loop closing on brand-new schema.

**Attio coverage:** `schema.create_object`, `update_object`, `get_object`, `list_attributes`, `create_attribute` (on an object), `update_attribute`, `list_statuses`, `create_status`, `update_status` (rename + archive), `list_select_options`, `create_select_option`, `update_select_option` · `records.create` + `query` on the custom object · cross-cutting: codegen picks up new object/constants; idempotent rerun.

**QA checklist:** object + attributes visible in Attio UI; second run reports zero changes; archived stage/option absent from active lists; generated file gained `AttioQAPartnership*` constants; the partnership record round-trips typed.

---

## Coverage matrix (56/56)

| Tool | Action → Scenario |
|---|---|
| records | search S1 · upsert S1 · create S1,S2,S7 · get S1,S3,S4,S5,S6 · query S2 (paginated+filtered), S6, S7 · update S2,S3 (both modes), S4 · delete S2 · get_attribute_history S2 |
| workspace_members | list S1,S2 · get S1,S4 |
| tasks | create S2,S3 · list S2,S4 · get S4 · update S4 · delete S4 |
| notes | create S3,S5 · list S3,S4,S5 · get S4 · delete S3 |
| comments | create S3 (record thread), S4 (thread reply) · list_threads S4 · get_thread S4 · get S4 · delete S4 |
| lists | create S5 · list S5 · get S5 · update S5 · add_entry S5 · upsert_entry S5 · query_entries S5 · get_entry S5 · update_entry S5 · remove_entry S5 |
| meetings | list S3 · get S3 · list_recordings S3 · get_transcript S3 (NOT COVERED allowed) |
| files | upload S6 · list S6 · get S6 · get_download_url S6 · delete S6 |
| schema | list_objects S1 · list_statuses S1,S7 · create/update/get_object S7 · create_attribute S5 (list), S7 (object) · update_attribute S7 · list_attributes S7 · create/update_status S7 · create/update/list_select_options S7 |

Cross-cutting: option constants + literal unions S1,S7 · honest actor types S1,S4 · pagination S2,S5 · Attio triggers + event flattening S4,S6 · idempotency S1,S5,S7 · pseudo-merge (no merge API exists) S2 · error legibility everywhere.

## Prerequisites
- Attio app scopes per `ATTIO-QA-PLAN.md`; reconnect the integration after scope changes. `terse generate` before S1 and again inside S7.
- Meetings/transcripts need real synced meeting data (S3 has an explicit NOT COVERED path).
- Attio cannot delete objects/attributes via API: S7's object persists (stages/options archive instead). Expected, not a failure.
