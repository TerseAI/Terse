# Testing Safety Conventions

These conventions govern every local execution of a job — `terse test run`, `terse replay`, and any probe. Local runs execute the real handler with real credentials: nothing about a test run is sandboxed unless you point it somewhere safe.

## Real events in, test targets out

Sample events (`terse test list`, `terse replay`) are real production data; using them as *inputs* is the point — realistic payloads catch real bugs. The line is side effects: a test run must never land writes on real people or real surfaces. Emails, messages, ticket updates, CRM writes — during test runs these go to the test targets the user named, never to the customer, channel, or record in the event.

The one sanctioned exception is the single verification run after swapping to real targets, announced to the user before it fires.

## Test API keys

When the work touches an external API that bills or has customer-visible effects (Stripe, Resend, …), ask the user once — fold it into the test-targets question — whether the platform has a test or sandbox key: "Does this have a test-mode key I should use while building? If so, add it with `terse secrets add <NAME>`." Use the test key for every local run; swapping to the live secret is part of the final swap to real targets.

Secret values are write-only: never try to read a stored secret to check whether it is a test or live key. Discovery is by asking, not inspecting.

## No test key: reads are free, writes ask first

Without a test key, local runs share credentials with production:

- **Reads never need permission.** Listing, fetching, and querying production data during a test run is always fine.
- **Writes ask per surface.** Before the first local run that writes to a production surface (a real repo, a live audience, a customer record), ask the user explicitly about that surface. One ask covers later runs against the same surface; a new surface is a new ask.

## Probing external state

A probe is a read-only discovery run against an external API — list the audiences in Resend, find the verified domain — whose result feeds job code.

**Never probe by temporarily rewriting a job's function body.** Mutating job code that must be restored afterwards is how probe scaffolding leaks into production.

Probe with a scratch probe job instead:

1. Create `src/jobs/_probe.ts`: a throwaway job with a cron trigger whose handler does the reads and logs the results.
2. Add its side-effect import to `src/terse.jobs.ts`. This import line is the only sanctioned temporary edit to existing files.
3. Run it with `terse test run` (cron triggers get synthetic sample events), so secrets hydrate exactly as they do for real jobs.
4. Record what it found, then delete both the probe file and its import line.

A probe must never be deployed — `terse deploy` syncs every job in the project, so delete the probe before any deploy. Probes are read-only; a probe that needs to write is not a probe, it is a milestone.

What a probe finds lands in job code as named, explicitly typed constants — see "Discovered values are typed constants" in the code conventions.
