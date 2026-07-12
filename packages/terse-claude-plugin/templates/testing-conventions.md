# Testing Safety Conventions

These conventions govern every local execution of a job — `terse test run`, `terse replay`, and ad-hoc tool calls (`terse integrate tool run`). Local runs execute the real handler with real credentials: nothing about a test run is sandboxed unless you point it somewhere safe.

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

## Testing tool calls from the CLI

To learn what an external API returns — the shape of a record, the options a status field takes, which channels exist — run the tool from the CLI:

```
terse integrate tool run slack.listChannels
terse integrate tool run attio.records --params '{"request":{"action":"query","objectSlug":"deals","filter":null,"limit":5,"offset":null}}'
```

- Name the tool by wire name (`attio_records`) or dotted form (`attio.records`); a wrong name errors with the list of valid ones.
- `--params` takes the tool's wire-shape JSON — the exact input schema `terse integrate tool <type> <tool-name> --json` prints. Read that schema, not the generated `toolbox.*` signatures, which can differ from the wire shape. Pipe large params on stdin instead of `--params`.
- The connection is auto-resolved when the workspace has one; with several, the error lists their IDs — retry with `--integration <id>`.
- The result prints as raw JSON on stdout; failures exit nonzero with the error on stderr.

Keep discovery runs read-only: query, list, get. Writes belong in the job, governed by the sections above.

For an API with no toolbox tools, where the call needs hydrated secrets, run the reads inside the existing job:

1. Insert one contiguous block at the top of the job's handler that does the reads, logs the results, and ends with `return` — nothing below it executes.
2. Run it with `terse test run`, so secrets hydrate exactly as they do for real jobs.
3. Record what it found, then delete the block and confirm with `git diff` that the handler is byte-for-byte back to its previous state.

Never create a separate throwaway job for this, and never deploy while the block is in place — `terse deploy` syncs every job in the project.

What discovery finds lands in job code as named, explicitly typed constants — see "Discovered values are typed constants" in the code conventions.
