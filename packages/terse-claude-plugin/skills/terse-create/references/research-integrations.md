# Integration researcher

A read-only research task on third-party platforms that Terse does not cover with a built-in integration — the external rungs of the orchestrator's integration ladder (rung 3: official SDK; rung 4: community wrapper or hand-rolled typed fetch client). Dispatched only after the workspace and docs briefs confirm the gap. If you are running as a subagent, this file plus the context block is everything you need, and your entire reply must be the research brief. If no subagent harness is available, the orchestrator follows this template inline and writes out the same brief before continuing.

## Context from the orchestrator

<!-- Replace this block when dispatching: for each gap service, what the workflow needs from it (events consumed, actions performed, data read or written), plus any interview answers that constrain the choice. -->

## Objectives

<!-- Replace this block when dispatching: the specific questions this brief must answer, e.g. "Is there an official Notion TypeScript SDK and what auth does it need?", "Which endpoint creates a database row?". Every search and fetch must serve one of these. -->

## Instructions

1. Research the minimum that answers the objectives: stop as soon as each service's brief section can be filled. An unanswered objective goes in that section as an open question, not into more searching.
2. For each service, find the platform's official TypeScript SDK. Validate that it is official: published under the vendor's npm org or linked from the vendor's developer docs or GitHub org.
3. If no official SDK exists, research the leading community wrapper and gather the required adoption evidence (GitHub stars, years maintained, date of last release, weekly npm downloads, maintainer reputation), and locate the REST API docs a hand-rolled typed fetch client would be built from. Recommend nothing silently — the orchestrator puts that choice to the user.
4. Identify the auth model: credential type, required scopes, and where a user obtains it.
5. When obtaining the credential takes manual work in the platform's console or dashboard (enable an API, create a service account, generate a key, share a resource), fetch the platform's official setup documentation and build the Setup walkthrough section from it. One trust policy governs everything in the walkthrough — URLs, role names, scope strings, sharing levels:
   - Include a URL only if you fetched it this session and confirmed it is the right page. Never write a URL from memory — a plausible-but-wrong link is worse than none.
   - If a direct deep link cannot be verified, link the official how-to doc that covers the step. If neither exists, give the exact UI navigation path ("Console → IAM & Admin → Service Accounts → Create service account") and mark the step `(unverified)`.
   - Name the minimal role/scope/sharing level the workflow needs, with the doc URL that evidences it. If you found no doc evidence and are working from memory, mark it `(from memory — unverified)`. If the platform's docs push a broader convenience role, recommend the minimal one and note the divergence.
6. Web search and fetch only: do not install packages, edit files, or call the third-party API.

## Research brief (required output shape)

One section per service:

### <Service>
- **Recommended rung**: official SDK, or user's choice between community wrapper and hand-rolled client, per the ladder.
- **Package**: exact npm name, with the evidence (URL) that it is official — or the community candidate with its adoption evidence.
- **Auth**: credential type and scopes, where the user obtains it, and the secret name to store via `terse secrets add`. Say whether the credential is a scalar token or a file (JSON key, PEM); file credentials get a `_B64`-suffixed name and are stored base64-encoded per the orchestrator's Credentials rule.
- **Setup walkthrough**: required whenever obtaining the credential involves manual steps. Numbered steps a non-expert can follow end to end: each step names the exact UI elements to click, carries its verified link (or the fallback from the trust policy, with its `(unverified)` marker), and states the minimal role/scope/sharing grant with the doc URL that evidences it. End with the secret name(s) to store; the orchestrator turns those into the storage commands.
- **Key methods/endpoints**: for each action the workflow needs, the SDK method or REST endpoint that performs it.
- **Risks and limits**: rate limits, webhook availability, pagination, or anything else that shapes the job design.
