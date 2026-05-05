# ai-product-owner (Terse)

## What this codebase does

Terse is a multi-tenant SaaS for "AI workflows as code". pnpm monorepo:
Express + Prisma backend (`backend/`), React 19 + Vite frontend
(`frontend/`), public `terse-cli` / `terse-sdk` (`packages/`), shared
types (`terse-types/`, `shared/`). The backend hosts OAuth integrations
(Slack, GitHub, Linear, Notion, Gmail, Attio, PostHog, LaunchDarkly,
Datadog, Snowflake, WorkOS), runs OpenAI Agents SDK workflows, and
ingests webhooks from those providers. Postgres + pgvector, Google
Secret Manager for credentials, WorkOS for auth.

## Auth shape

- **`authMiddleware` / `authMiddlewareAllowNoOrg`** (`routes/auth.ts`) —
  WorkOS sealed-session cookie auth. The default (`authMiddleware`)
  also requires `req.session.user.organizationId`; the `…AllowNoOrg`
  variant only gates the org-create flow.
- **`apiTokenAuthMiddleware`** (`routes/apiTokenAuth.ts`) — Bearer
  token auth for programmatic access. Tokens SHA-256 hashed at rest in
  `api_tokens`; populates `req.session` with a partial `User` (empty
  email/displayName — by design). Mounted globally near the top of
  `server.ts`; webhook / cron / device-token routes are deliberately
  registered *above* it to opt out.
- **`validateCloudSchedulerRequest`** (`utility/cloudScheduler.ts`) —
  shared-secret Bearer check for Google Cloud Scheduler endpoints
  (`/refresh-tokens`, `/cleanup-sdk-images`, `/review-agents`, …).
- **Webhook signature verifiers** — per-provider HMAC checks using
  `crypto.timingSafeEqual` against the raw `Buffer` body parsed via
  `express.raw()` (Linear, WorkOS, WorkOS-trigger, web-monitor). The
  internal SDK ↔ Terse handshake lives in `utility/webhookHmac.ts`.
- **Tenant scoping** — every authenticated Prisma query filters by
  `organization_id: req.session.user.organizationId`. This is the
  primary multi-tenancy boundary; missing it = cross-tenant IDOR.

## Threat model

Multi-tenant SaaS holding live OAuth tokens for customer Slack /
GitHub / Notion / Gmail / Linear / Snowflake / Datadog accounts plus
user-authored agent code that the platform executes. Attacker goals,
ranked: (1) cross-tenant data access via missing `organization_id`
filter on a route or socket handler; (2) exfiltrate OAuth/API
credentials from `*_integrations` tables or Google Secret Manager;
(3) forge or replay webhook deliveries to trigger another tenant's
agents; (4) SSRF via SDK `remote_server_url` or other user-supplied
URLs reachable from the backend; (5) abuse the agent tool layer to run
write actions without the human-approval gate.

## Project-specific patterns to flag

- **Missing `organization_id` filter.** Any `db().<table>.findMany /
  findFirst / update / delete` inside a route guarded by
  `authMiddleware` MUST include `organization_id:
  req.session.user.organizationId` (or scope through a parent that
  does). Compare to `routes/project.ts` for the canonical shape.
- **Webhook / cron route placed after `app.use(apiTokenAuthMiddleware)`
  in `server.ts`.** That middleware short-circuits with 401 on any
  `Bearer` it can't match. New unauthenticated ingestion endpoints
  (cron, third-party webhooks) must be mounted *above* line 293 and
  carry their own signature/secret check.
- **Webhook handler that doesn't verify a signature with
  `crypto.timingSafeEqual` against the raw body.** Reference:
  `verifySignature` in `routes/linear.ts` and `utility/webhookHmac.ts`.
  Flag handlers comparing with `===`, parsing JSON before verifying,
  or skipping verification when a header is absent.
- **SSRF via user-supplied URL.** Outbound `fetch` to a URL coming from
  request input or DB (notably `project.remote_server_url`,
  notification destinations, web-monitor targets) must go through
  `validateRemoteServerUrl` (`utility/urlValidation.ts`). HTTP-to-
  localhost is intentionally allowed only when `settings.nodeEnv ===
  "development"`.
- **Integration credential stored as plaintext in Prisma.** OAuth
  access/refresh tokens and API keys go through `secretManagerClient`
  (`utility/secretManagerClient.ts`); the DB row only holds the
  Secret Manager reference. Flag new `*_integrations` columns that
  store raw `access_token` / `api_key` / `client_secret` values.
- **Write-capable agent tool without `createNeedsApprovalFunction`.**
  Tools in `tools/availableTools.ts` that mutate external state must
  set `needsApproval` via `createNeedsApprovalFunction` from
  `tools/toolUtils.ts`; `validateToolNames.ts` enforces this at
  startup.

## Known false-positives

- `dist/`, `node_modules/`, `.deepsec/node_modules/`, `frontend/dist/`,
  `backend/dist/` — generated/vendored. Skip.
- `frontend/src/shared/` and `backend/src/shared/` — copies of root
  `shared/` produced by `copy-shared.js`. The root is the source of
  truth; "duplicated logic" findings here are noise.
- `samples/`, `terse-probot-app/`, `slack_manifest.json`,
  `workosBranding/`, `scripts/` — fixtures, manifests, one-off ops
  scripts; not on the request path.
- `validateRemoteServerUrl` permitting plain `http://localhost` —
  intentional dev-mode branch gated on `settings.nodeEnv ===
  "development"`, not a prod bypass.
- `apiTokenAuthMiddleware` calling `next()` with no session when the
  `Authorization` header is missing — intentional fallthrough so the
  downstream cookie-based `authMiddleware` can run.
- `api_tokens` rows storing only `token_hash` (SHA-256, no salt) —
  acceptable here because the raw token is a 256-bit random secret,
  not a user-chosen password.
