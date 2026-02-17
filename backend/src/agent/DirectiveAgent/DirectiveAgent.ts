import { Agent, run } from "@openai/agents"
import { z } from "zod"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { User } from "../../shared/types"
import { EventEmitterTaskQueue } from "../../tasks/abstract/eventEmitterTasks"
import { Task } from "../../tasks/abstract/tasks"
import { RunHistoryChatMemorySession, identityHistoryCallback } from "../CustomMemorySession"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"

const DIRECTIVE_TASK_NAME = "DIRECTIVE_TASK" as const

export class DirectiveTask implements Task {
    readonly taskName = DIRECTIVE_TASK_NAME
    constructor(
        public automationId: string,
        public runHistoryId: string,
        public user: User,
        public message: string
    ) {}
}

const DirectiveClassification = z.object({
    isDirective: z.boolean(),
    directiveDescription: z.string()
})

type DirectiveClassificationType = z.infer<typeof DirectiveClassification>

async function classifyDirective(task: DirectiveTask): Promise<DirectiveClassificationType> {
    const session = new RunHistoryChatMemorySession({
        sessionId: task.runHistoryId,
        skipSave: true
    })

    const runConfig = {
        runId: task.runHistoryId,
        agentType: AgentType.DIRECTIVE,
        agentId: task.automationId,
        user: task.user,
        env: settings.nodeEnv
    }

    const runner = runnerFactory(runConfig)

    const directiveAgent = new Agent({
        name: "Directive Classifier Agent",
        instructions: `You are a classifier that decides whether the **latest user message** is a DIRECTIVE to the Terse AI system.
    
    ### Definition
    
    A *directive* is:
    
    - A message that expresses a **rule, preference, or policy** for how Terse AI should behave **from now on or in general**, not just for a single request.
    - It typically changes how future messages should be handled, or sets a standing preference.
    
    A directive is **not**:
    
    - A one-off task, request, or question that only applies **right now**.
    - A request to perform a concrete action once.
    
    ### Examples
    
    **Directives (isDirective = true)**
    
    - "Always summarize tickets before creating them."
    - "Use a more formal tone in responses from now on."
    - "Don't create tickets automatically."
    - "Whenever someone tags me, create a Jira ticket."
    - "In this channel, only notify me about high-priority issues."
    
    **Non-directives (isDirective = false)**
    
    - "What's the status of ticket ABC-123?"
    - "Create a ticket for this bug."
    - "Show me recent activity."
    - "Can you draft a reply to this email?"
    - "Please create a Jira ticket with the following details."
    
    **Borderline examples**
    
    - "Stop creating tickets for every message" → directive (changes ongoing behavior)
    - "Don't create a ticket for this one" → non-directive (one-off)
    - "I'd prefer if you didn't create tickets automatically" → directive (preference about future behavior)
    
    ### Classification Rules
    
    1. Mark **isDirective = true** if the message:
      - Describes how Terse AI should behave **in general** or **from now on**, OR
      - Changes settings, preferences, or policies for future behavior, even if phrased politely.
    
    2. Mark **isDirective = false** if the message:
      - Is only about a single action or request right now, OR
      - Is just a question or a request for information.
    
    3. If you are uncertain, **err on the side of isDirective = false**.
    
    ### Output format
    
    Return a JSON object with:
    
    - \`isDirective\`: boolean  
    - \`directiveDescription\`: 
      - If \`isDirective = true\`: a **short, imperative summary** of the directive (e.g. "Only create tickets for high-priority issues").
      - If \`isDirective = false\`: an **empty string**.
    
    Do not include explanations or any extra fields. Only output the JSON object.`,
        model: "gpt-5-nano",
        outputType: DirectiveClassification,
        modelSettings: builderProviderDataModelSettings(runConfig)
    })

    const result = await runner.run(directiveAgent, [{ role: "user", content: task.message }], {
        session,
        sessionInputCallback: identityHistoryCallback
    })

    return result.finalOutput ?? { isDirective: false, directiveDescription: "" }
}

async function persistDirective(automationId: string, runHistoryId: string, directiveDescription: string): Promise<string> {
    const prisma = db()
    const directiveRecord = await prisma.directive_records.create({
        data: {
            automation_id: automationId,
            run_history_record_id: runHistoryId,
            run_history_chat_event_id: null,
            directive_description: directiveDescription
        }
    })
    return directiveRecord.id
}

// --- Task Queue ---

export const directiveTaskQueue = new EventEmitterTaskQueue<DirectiveTask>()

directiveTaskQueue.addListener({
    taskName: DIRECTIVE_TASK_NAME,
    onTask: async (task: DirectiveTask) => {
        try {
            logger.info(`[Directive] Classifying message: "${task.message.slice(0, 100)}${task.message.length > 100 ? "..." : ""}"`)
            const directive = await classifyDirective(task)
            logger.info(`[Directive] Result: isDirective=${directive.isDirective}${directive.isDirective ? `, description="${directive.directiveDescription}"` : ""}`)
            if (directive.isDirective) {
                await persistDirective(task.automationId, task.runHistoryId, directive.directiveDescription)
                logger.info(`[Directive] Persisted directive for automation ${task.automationId}`)
            }
        } catch (error) {
            logger.error(`[Directive] Failed to process directive task:`, { error })
        }
    }
})
