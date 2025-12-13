import { CompositeHydrator, Hydrator, Identifiable } from "./Hydrator";
import { RunHistoryRawEventHydrator, IdentifiableRunHistoryRawEvent } from "./runHistoryRag/hydrator";
import { HydratorType, HydratorTypeMap, RAGNamespace, NamespaceToHydratorType } from "../types/rag";

// Individual hydrator instances
const runHistoryHydrator = new RunHistoryRawEventHydrator();

// Pre-composed hydrators per namespace
export const NAMESPACE_HYDRATORS = {
    [RAGNamespace.RUN_HISTORY_MEMORY]: new CompositeHydrator(runHistoryHydrator),
    // TODO: Add slackEventHydrator to EVENT_MEMORY when implemented:
    // [RAGNamespace.EVENT_MEMORY]: new CompositeHydrator(runHistoryHydrator, slackEventHydrator),
} as const;

// Type helper: extract the composite hydrator type for a namespace
export type NamespaceHydrator<N extends RAGNamespace> = typeof NAMESPACE_HYDRATORS[N];

export function getHydratorForNamespace<N extends RAGNamespace>(
    namespace: N
): typeof NAMESPACE_HYDRATORS[N] {
    return NAMESPACE_HYDRATORS[namespace];
}

// Legacy registry for backward compatibility
export const HYDRATOR_REGISTRY: Hydrator<Identifiable>[] = [runHistoryHydrator];

export function getHydrator<K extends HydratorType>(
    entityType: K
): Hydrator<HydratorTypeMap[K]> | undefined {
    return HYDRATOR_REGISTRY.find(h => h.entityType === entityType) as Hydrator<HydratorTypeMap[K]> | undefined;
}

export function requireHydrator<K extends HydratorType>(
    entityType: K
): Hydrator<HydratorTypeMap[K]> {
    const hydrator = getHydrator(entityType);
    if (!hydrator) {
        throw new Error(`No hydrator registered for entityType: ${entityType}`);
    }
    return hydrator;
}
