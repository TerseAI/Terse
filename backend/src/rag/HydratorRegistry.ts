import { Hydrator, Identifiable } from "./Hydrator";
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator";
import { HydratorType, HydratorTypeMap } from "../types/rag";

export const HYDRATOR_REGISTRY: Hydrator<Identifiable>[] = [new RunHistoryRawEventHydrator()];

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
