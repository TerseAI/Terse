import { HydratorType } from "terse-types"

import { HydratorTypeMap, RAGNamespace } from "../types/rag"

import { CompositeHydrator, HydrationContext, Hydrator, Identifiable } from "./Hydrator"
import { GithubEventHydrator } from "./github/hydrator"
import { GmailEventHydrator } from "./gmail/hydrator"
import { LinearEventHydrator } from "./linear/hydrator"
import { RunHistoryRawEventHydrator } from "./runhistory/hydrator"
import { SlackEventHydrator } from "./slack/hydrator"
import { WebMonitorEventHydrator } from "./webmonitor/hydrator"
import { WorkOSEventHydrator } from "./workos/hydrator"

// Type-safe hydrator factory map
const HYDRATOR_FACTORIES: {
    [K in HydratorType]: (ctx: HydrationContext) => Hydrator<HydratorTypeMap[K]>
} = {
    run_history_raw_event: ctx => new RunHistoryRawEventHydrator(ctx),
    slack_message_event: ctx => new SlackEventHydrator(ctx),
    github_event: ctx => new GithubEventHydrator(ctx),
    linear_event: ctx => new LinearEventHydrator(ctx),
    gmail_event: ctx => new GmailEventHydrator(ctx),
    workos_event: ctx => new WorkOSEventHydrator(ctx),
    webmonitor_event: ctx => new WebMonitorEventHydrator(ctx)
}

// Create a composite hydrator for a namespace with context
function createNamespaceHydrator(namespace: RAGNamespace, ctx: HydrationContext): CompositeHydrator<Hydrator<Identifiable>[]> {
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
function getHydrator<K extends HydratorType>(entityType: K, ctx: HydrationContext): Hydrator<HydratorTypeMap[K]> | undefined {
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
