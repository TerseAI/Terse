import { Terse as TerseClient, TerseAgent, type WebhookTrigger } from "terse-sdk"
import {
    GitHub,
    Repos,
    Slack,
    SlackChannel,
    Gmail,
    Linear,
    LinearTeam,
    LinearProject,
    Notion,
    NotionDatabase,
    NotionPage,
    Posthog,
    PosthogProject,
    Datadog,
    DatadogIndex,
    LaunchDarkly,
    LaunchDarklyProject,
    WorkOS,
    Attio,
    AttioObject,
    Snowflake,
    Schedule,
    Webhook,
    Terse as TerseSkills,
} from "./terse.generated"

const client = new TerseClient()

// ─── Job 1: Simple webhook trigger, no skills ───────────────────────────────
// Validates the minimal job shape: a single webhook trigger calling the agent.

await client.createJob({
    name: "Tell me a joke",
    triggers: [Webhook.onRequest()],
    skills: [],
    onTrigger: async (event: WebhookTrigger, Agent: TerseAgent) => {
        await Agent.runAndWait("Tell me a funny joke")
    },
})

// ─── Job 2: Kitchen sink -- every trigger type + every skill ─────────────────
// Validates the full API surface. If any config constructor, trigger factory,
// or skill factory signature changes, this job will fail to compile.

await client.createJob({
    name: "Kitchen sink",
    triggers: [
        GitHub.onPROpened({ repo: Repos.CIOrg.SampleRepo }),
        Slack.onMessage({ channel: SlackChannel.General }),
        Gmail.onEmail(),
        Linear.onIssueCreated({ team: LinearTeam.Engineering, project: LinearProject.CIProject }),
        WorkOS.onUserCreated(),
        Schedule.cron({ expression: "0 9 * * 1" }),
        Webhook.onRequest(),
    ],
    skills: [
        GitHub.skill({ repos: [Repos.CIOrg.SampleRepo, Repos.CIOrg.AnotherRepo] }),
        Slack.skill({ channel: SlackChannel.General }),
        Gmail.skill(),
        Gmail.draftSkill(),
        Linear.skill({ team: LinearTeam.Engineering, project: LinearProject.CIProject }),
        Notion.skill({ databases: [NotionDatabase.Tasks], pages: [NotionPage.Welcome] }),
        Posthog.skill({ project: PosthogProject.Main }),
        Datadog.skill({ indexes: [DatadogIndex.Main] }),
        LaunchDarkly.skill({ project: LaunchDarklyProject.Main, environmentKeys: ["production", "staging"] }),
        WorkOS.skill(),
        Attio.skill({ object: AttioObject.Companies }),
        Snowflake.skill(),
        TerseSkills.skill(),
    ],
    onTrigger: async (event, Agent) => {
        await Agent.runAndWait("Handle the event: " + event.formatForAgentRunner())
    },
})
