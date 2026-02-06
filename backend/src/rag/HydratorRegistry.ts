import { HydratorType, HydratorTypeMap, RAGNamespace } from "../types/rag"

import { CompositeHydrator, HydrationContext, Hydrator, Identifiable } from "./Hydrator"
import { FigmaCommentEventHydrator } from "./figmaRag/hydrator"
import { GithubEventHydrator } from "./githubRag/hydrator"
import { GmailEventHydrator } from "./gmailRag/hydrator"
import { JiraEventHydrator } from "./jiraRag/hydrator"
import { LinearEventHydrator } from "./linearRag/hydrator"
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator"
import { SlackEventHydrator } from "./slackRag/hydrator"

// Type-safe hydrator factory map
const HYDRATOR_FACTORIES: {
    [K in HydratorType]: (ctx: HydrationContext) => Hydrator<HydratorTypeMap[K]>
} = {
    [HydratorType.RUN_HISTORY_RAW_EVENT]: ctx => new RunHistoryRawEventHydrator(ctx),
    [HydratorType.SLACK_MESSAGE_EVENT]: ctx => new SlackEventHydrator(ctx),
    [HydratorType.GITHUB_EVENT]: ctx => new GithubEventHydrator(ctx),
    [HydratorType.LINEAR_EVENT]: ctx => new LinearEventHydrator(ctx),
    [HydratorType.GMAIL_EVENT]: ctx => new GmailEventHydrator(ctx),
    [HydratorType.FIGMA_COMMENT_EVENT]: ctx => new FigmaCommentEventHydrator(ctx),
    [HydratorType.JIRA_EVENT]: ctx => new JiraEventHydrator(ctx)
}

// Create a composite hydrator for a namespace with context
export function createNamespaceHydrator(namespace: RAGNamespace, ctx: HydrationContext): CompositeHydrator<Hydrator<Identifiable>[]> {
    const runHistoryHydrator = new RunHistoryRawEventHydrator(ctx)

    switch (namespace) {
        case RAGNamespace.RUN_HISTORY_MEMORY:
            return new CompositeHydrator(runHistoryHydrator)
        // Add more namespaces as needed:
        // case RAGNamespace.EVENT_MEMORY:
        //     const slackEventHydrator = new SlackEventHydrator(ctx);
        //     return new CompositeHydrator(runHistoryHydrator, slackEventHydrator);
        default:
            return new CompositeHydrator(runHistoryHydrator)
    }
}

// Get a hydrator by type (requires context)
export function getHydrator<K extends HydratorType>(entityType: K, ctx: HydrationContext): Hydrator<HydratorTypeMap[K]> | undefined {
    const factory = HYDRATOR_FACTORIES[entityType]
    return factory ? factory(ctx) : undefined
}

// Require a hydrator by type (throws if not found)
export function requireHydrator<K extends HydratorType>(entityType: K, ctx: HydrationContext): Hydrator<HydratorTypeMap[K]> {
    const hydrator = getHydrator(entityType, ctx)
    if (!hydrator) {
        throw new Error(`No hydrator registered for entityType: ${entityType}`)
    }
    return hydrator
}
