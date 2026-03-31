> Review and customize this file as Terse terminology, audiences, and boundaries evolve.
> Prefer Mintlify built-in components over custom MDX when they improve scanability.

# Documentation project instructions

## About this project

- This is a documentation site built on [Mintlify](https://mintlify.com)
- Pages are MDX files with YAML frontmatter
- Configuration lives in `docs.json`
- Run `mint dev` to preview locally
- Run `mint broken-links` to check links

## Terminology

- Use "workflow" for code-defined automations deployed with the CLI.
- The SDK method is `createWorkflow()`. Use this name consistently in code and prose.
- Use "agent" for UI-created automations, or when the product UI itself uses the word "Agents".
- Use "integration" for a connected external system such as Attio, Apollo, Slack, Outreach, or Snowflake.
- Use "skill" for the capabilities a workflow can use after you connect an integration and run code generation.
- Use "trigger" for the event or schedule that starts a workflow.
- Use "generated helpers" for the typed exports written to `src/terse.generated.ts`.
- Use "deploy" for syncing local code to Terse. Do not say "publish" unless the product UI does.
- Use "API token" when referring to the token users create in the UI. Use `TERSE_API_KEY` when referring to the environment variable.

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise and concrete
- Use an opinionated, direct tone. Aim for Stripe or Vercel energy.
- Use sentence case for headings
- Bold for UI elements: Click **Settings**
- Code formatting for file names, commands, paths, and code references
- Lead with the workflow, then explain why it matters
- Prefer TypeScript examples unless the page explicitly covers another SDK
- Default to GTM examples: CRM enrichment, routing, alerts, pipeline reporting, and handoff workflows
- Use Attio as the primary CRM in examples unless a page needs CRM-agnostic language
- Use Apollo as the primary enrichment provider in examples unless a page needs provider-agnostic language
- State prerequisites before commands that depend on integrations, sample events, or an API token
- Call out generated files clearly. Do not imply that users should hand-edit `src/terse.generated.ts`
- When the UI and CLI overlap, explain which source of truth owns the configuration
- Use the live UI label for buttons, tabs, and sidebar items. If the SDK still says "job" in code, explain that once and then keep using "workflow" in prose.

## Content boundaries

- Prioritize external developer docs for TypeScript workflows, CLI workflows, templates, and the parts of the web UI needed to operate them.
- Document the user-visible app areas that matter for code workflows: Home, Workflows, Integrations, Activity, Stats, Notifications, and Profile.
- Mention UI agents only when users need orientation or migration context.
- Treat templates and comparison pages as first-class product docs, not side content.
- Frame planned GTM integrations as waitlist or coming soon. Keep the current path clear.
- Do not document internal admin tools, internal-only templates, implementation details of backend services, or unreleased product behavior.
- Keep Python CLI and Python SDK details out of the first-draft product docs unless a page explicitly calls them out as a secondary path.
- Avoid internal implementation detail. Optimize for the clearest product story users can act on.
