# terse-sdk

TypeScript SDK for building jobs on the [Terse](https://terse.ai) platform.

## Installation

```bash
npm install terse-sdk
```

## Quick Start

```typescript
import { Terse, TerseAgent } from "terse-sdk";
import { GitHub, Slack, Repos, SlackChannel } from "./terse.generated";

const client = new Terse();

client.createJob({
  name: "PR Summary Bot",
  triggers: [GitHub.onPROpened({ repo: Repos.MyOrg.MyRepo })],
  skills: [GitHub.skill({ repos: [Repos.MyOrg.MyRepo] }), Slack.skill({ channel: SlackChannel.General })],
  onTrigger: async (event, Agent) => {
    await Agent.runAndWait(`Summarize this PR: ${event.formatForAgentRunner()}`);
  },
});
```

## Core Concepts

- **`Terse`** — Entry point. Use `createJob()` to register jobs.
- **`TerseAgent`** — Passed into your `onTrigger` handler. Call `agent.run()` for streaming results or `agent.runAndWait()` to run to completion.
- **Triggers** — Config instances (e.g. `GitHub.onPROpened()`) that define when a job fires.
- **Skills** — Integration configs (e.g. `Slack.skill()`) that give the model access to tools during `run()` / `runAndWait()`.
- **Deterministic wrappers** — Generated `agent.tools.*` helpers that you call directly; these can be available from trigger integrations as well as declared skills.
- **Events** — Typed trigger events (`GitHubPullRequestTrigger`, `WorkOSUserTrigger`, etc.) with type guards like `isGitHubPullRequestTrigger()`.

## API

### `TerseAgent`

| Method | Description |
|---|---|
| `run(prompt, event?)` | Returns an `AsyncGenerator<TerseAgentResult>` streaming agent output |
| `runAndWait(prompt, event?)` | Runs the agent to completion, discarding streamed output |
| `executeTool(toolName, params?)` | Directly execute a single tool by name |

### Event Types

The SDK provides typed event classes and type guards for supported integrations:

- **GitHub**: `GithubTrigger`, `GitHubPullRequestTrigger`, `GitHubPushTrigger`
- **WorkOS**: `WorkOSTrigger`, `WorkOSUserTrigger`, `WorkOSMembershipTrigger`, `WorkOSInvitationTrigger`

## Environment Variables

| Variable | Description |
|---|---|
| `TERSE_API_KEY` | Required. API key for authenticating with the Terse platform. |
