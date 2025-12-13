import { CompositeHydrator, Hydrator, Identifiable, HydrationContext } from "./Hydrator";
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator";
import { SlackEventHydrator } from "./slackRag/hydrator";
import { HydratorType, HydratorTypeMap, RAGNamespace } from "../types/rag";

// Type-safe hydrator factory map
const HYDATOR_FACTORIES: {
    [K in HydratorType]: (ctx: HydrationContext) => Hydrator<HydratorTypeMap[K]>;
} = {
    [HydratorType.RUN_HISTORY_RAW_EVENT]: (ctx) => new RunHistoryRawEventHydrator(ctx),
    [HydratorType.SLACK_MESSAGE_EVENT]: (ctx) => new SlackEventHydrator(ctx),
};

// Create a composite hydrator for a namespace with context
export function createNamespaceHydrator(
    namespace: RAGNamespace,
    ctx: HydrationContext
): CompositeHydrator<Hydrator<Identifiable>[]> {
    const runHistoryHydrator = new RunHistoryRawEventHydrator(ctx);
    
    switch (namespace) {
        case RAGNamespace.RUN_HISTORY_MEMORY:
            return new CompositeHydrator(runHistoryHydrator);
        // Add more namespaces as needed:
        // case RAGNamespace.EVENT_MEMORY:
        //     const slackEventHydrator = new SlackEventHydrator(ctx);
        //     return new CompositeHydrator(runHistoryHydrator, slackEventHydrator);
        default:
            return new CompositeHydrator(runHistoryHydrator);
    }
}

// Get a hydrator by type (requires context)
export function getHydrator<K extends HydratorType>(
    entityType: K,
    ctx: HydrationContext
): Hydrator<HydratorTypeMap[K]> | undefined {
    const factory = HYDATOR_FACTORIES[entityType];
    return factory ? factory(ctx) : undefined;
}

// Require a hydrator by type (throws if not found)
export function requireHydrator<K extends HydratorType>(
    entityType: K,
    ctx: HydrationContext
): Hydrator<HydratorTypeMap[K]> {
    const hydrator = getHydrator(entityType, ctx);
    if (!hydrator) {
        throw new Error(`No hydrator registered for entityType: ${entityType}`);
    }
    return hydrator;
}
