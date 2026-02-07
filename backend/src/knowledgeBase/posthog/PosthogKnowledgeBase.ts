import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { ToolboxEntry } from "../../outputs/abstract/Output"
import {
    extractToolMetadata,
    getConfigMetadata,
    type CapabilityDescription
} from "../../capabilityHelpers"
import { ConfigType, PosthogConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { KnowledgeBase } from "../abstract/KnowledgeBase"

import { getSessionEventsTool } from "./tools/getSessionEvents"
import { searchEventsTool } from "./tools/searchEvents"
import { searchLogsTool } from "./tools/searchLogs"
import { searchSessionsTool } from "./tools/searchSessions"

/**
 * PostHog Knowledge Base implementation.
 * Provides tools for querying PostHog logs and session recordings.
 */
export class PosthogKnowledgeBase extends KnowledgeBase<PosthogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: searchLogsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search logs" },
            { tool: searchSessionsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search sessions" },
            { tool: getSessionEventsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Get session events" },
            { tool: searchEventsTool as Tool, isReadOnly: true, integration: IntegrationType.POSTHOG, displayName: "Search events" }
        ]

        super(KnowledgeBaseConfigType.POSTHOG, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.POSTHOG)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.POSTHOG,
            integrationType: meta.integrationType,
            role: "knowledgeBase",
            tools,
            configFields: {
                integrationId: "PostHog integration connection",
                projectId: "PostHog project ID (from fetchResourcesForIntegration)",
                projectName: "Project display name"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentKnowledgeBaseWithConfigs {
        return {
            integration_id: "example",
            config_type: "POSTHOG" as any,
            id: "example",
            automation_id: "example",
            posthog_config: {
                automation_knowledge_base_id: "example",
                project_id: "example-project",
                project_name: "Example Project"
            }
        } as any
    }

    async validateConfig(knowledgeBase: PosthogConfig, _userId: string): Promise<void> {
        if (!knowledgeBase.projectId) {
            throw new Error("Invalid knowledge base config for posthog: missing projectId")
        }
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: PosthogConfig): Promise<void> {
        // Use unchecked input to bypass relation checks
        await tx.automation_posthog_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
                project_id: knowledgeBase.projectId,
                project_name: knowledgeBase.projectName || null
            }
        })
    }

    /**
     * Returns system instructions for PostHog knowledge base.
     * Provides guidance on when and how to use PostHog tools with an investigative mindset.
     */
    protected getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No PostHog KB configs provided")
        }

        const sections: string[] = []

        // Header
        sections.push("=== POSTHOG KNOWLEDGE BASE ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            if (!config.posthog_config) {
                throw new Error("PostHog config not found")
            }
            const projectId = config.posthog_config.project_id
            const projectName = config.posthog_config.project_name
            configList.push(`  • Integration ID: ${config.integration_id} - Project Name: ${projectName || "N/A"}, Project ID: ${projectId || "N/A"}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling PostHog tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        // Available tools section - list tools per integration ID
        const toolsByIntegration: string[] = []
        for (const config of configs) {
            if (!config.posthog_config) {
                throw new Error("PostHog config not found")
            }
            const integrationId = config.integration_id
            const projectName = config.posthog_config.project_name || "N/A"

            const availableTools = ["searchPosthogLogs", "searchPosthogSessions", "getPosthogSessionEvents", "searchPosthogEvents"]
            toolsByIntegration.push(`  Integration ID ${integrationId} (${projectName}): ${availableTools.join(", ")}`)
        }

        sections.push("\nAVAILABLE TOOLS BY INTEGRATION:")
        sections.push(toolsByIntegration.join("\n"))
        sections.push("\nTOOL DESCRIPTIONS:")

        sections.push(
            "• searchPosthogLogs: Query backend logs with flexible filtering options. " +
                "Can filter by user email, log severity levels (error, warn, info, debug), message text search, or combinations. " +
                "At least one filter must be provided. Returns log entries with timestamps, severity, messages, and attributes. " +
                "Supports pagination (offset parameter) and date filtering."
        )
        sections.push("• searchPosthogSessions: Find session recordings for a user by email. " + "Returns session IDs, timestamps, duration, and replay URLs.")
        sections.push(
            "• getPosthogSessionEvents: Decode a session's events (clicks, inputs, console logs, errors, navigation). " +
                "Use startSeconds/endSeconds to focus on specific time windows within a session."
        )
        sections.push(
            "• searchPosthogEvents: Query analytics events. Use countByEventNameOnly: true and customEventsOnly: true (defaults) to get counts for the project's custom-tracked events only (excludes PostHog built-ins like $pageview). Works for any user's PostHog project. Use customEventsOnly: false to include all events."
        )

        sections.push(`
INVESTIGATION STRATEGY:
Investigate like a human engineer would - be thorough and iterative, not superficial.

1. START BROAD:
   - Always use last7Days: true to capture full week context
   - Don't assume the issue happened in the most recent logs/session

2. PAGINATE THROUGH RESULTS:
   - If the first batch (50 logs) doesn't show a smoking gun, page through more
   - Use offset parameter: offset=0 for first 50, offset=50 for next 50, etc.
   - Continue until you find relevant evidence OR have reviewed at least 150-200 logs

3. CHECK MULTIPLE SESSIONS:
   - Don't stop at the most recent session - check 2-3 recent sessions
   - The bug might have occurred in an earlier session
   - Compare behavior across sessions to spot patterns

4. CROSS-REFERENCE DATA:
   - If logs show an error at timestamp T, check session events around that time
   - If a session shows unexpected behavior, look for corresponding backend logs
   - Match frontend events with backend processing

5. LOOK FOR PATTERNS:
   - Repeated errors or warnings
   - Unusual sequences of events
   - Failed network requests or console errors
   - Events that correlate with the reported issue timing

6. KNOW WHEN TO STOP:
   - You've reviewed logs across the relevant timeframe (last 7 days)
   - You've checked multiple sessions
   - You've cross-referenced frontend and backend data
   - If still no smoking gun, report what you searched and what you ruled out

DESCRIBING USER SESSIONS (CRITICAL):
When analyzing session data, describe WHAT THE USER DID in plain human terms. 
Do NOT dump technical metadata about the session structure.

GOOD - Describe the user's journey:
"In their session on Jan 7th, Olivier opened the app, navigated to Channels, clicked on a Gmail 
integration icon, and the text appeared cut off. He then scrolled down and clicked Settings."
(Replay: <sessionUrl>)

BAD - Technical metadata dump:
"Session 019b98c0-de78-7988-b0ce-1459b021bab6 contains 529 raw events, 93 meaningful events, 
including navigation to channels and Gmail-related paths; knowledge bases surfaced with ID 
cmk1r6qqm000dpr2jdeomx4qm but initial discovery showed empty knowledgeBases."
(This is useless noise - nobody cares about event counts or internal IDs)

Focus on:
- What pages/screens did the user visit?
- What did they click on?
- What did they type?
- What errors appeared (console errors, failed requests)?
- What was the sequence of their actions?

Never mention:
- Raw event counts or "meaningful event" counts
- Internal IDs (unless directly relevant to a bug)
- Technical session metadata
- Knowledge base initialization details

CITING EVIDENCE:
Every claim MUST be backed by specific, verifiable references.

When citing LOG evidence:
- Include the exact timestamp (e.g., "At 2026-01-08T16:03:22Z...")
- Quote the relevant log message or error
- Include the logsLink so the user can view all logs in PostHog

When citing SESSION evidence:
- Include the session replay URL so the user can watch it
- Reference the specific time within the session (e.g., "At 2:34 into session...")
- Describe what the user did in human terms

Example of GOOD report:
"In Olivier's session on Jan 7th (replay: <sessionUrl>), he navigated to the Channels page at 14:02 
and clicked the Gmail icon at 14:03. The icon's label text appears truncated. Backend logs at 
14:03:22Z show: 'No channels match this gmail event' (logs: <logsLink>), suggesting a mapping issue."

Example of BAD report:
"The session had 529 raw events and 93 meaningful events with Gmail-related processing."
(No user journey, no specifics, just useless metadata)

REPORTING:
Always summarize your investigation with citations:
- List specific sessions reviewed with their replay URLs
- List specific log entries found with timestamps
- Link to PostHog views so users can verify your findings
- Any patterns or anomalies observed (with evidence)
- What you ruled out and why
- Suggested next steps if inconclusive`)

        return sections.join("\n")
    }
}
