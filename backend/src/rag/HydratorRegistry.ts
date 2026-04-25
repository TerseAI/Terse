import { HydratorType } from "terse-types"

import { HydratorTypeMap, RAGNamespace } from "../types/rag"

import { CompositeHydrator, HydrationContext, Hydrator, Identifiable } from "./Hydrator"
import { GithubEventHydrator } from "./githubRag/hydrator"
import { GmailEventHydrator } from "./gmailRag/hydrator"
import { LinearEventHydrator } from "./linearRag/hydrator"
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator"
import { SlackEventHydrator } from "./slackRag/hydrator"
import { WebMonitorEventHydrator } from "./webMonitorRag/hydrator"
import { WorkOSEventHydrator } from "./workosRag/hydrator"

// Type-safe hydrator factory map
const HYDRATOR_FACTORIES: {
    [K in HydratorType]: (ctx: HydrationContext) => Hydrator<HydratorTypeMap[K]>
} = {
    ["run_history_raw_event"]: ctx => new RunHistoryRawEventHydrator(ctx),
    ["slack_message_event"]: ctx => new SlackEventHydrator(ctx),
    ["github_event"]: ctx => new GithubEventHydrator(ctx),
    ["linear_event"]: ctx => new LinearEventHydrator(ctx),
    ["gmail_event"]: ctx => new GmailEventHydrator(ctx),
    ["workos_event"]: ctx => new WorkOSEventHydrator(ctx),
    ["webmonitor_event"]: ctx => new WebMonitorEventHydrator(ctx)
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
