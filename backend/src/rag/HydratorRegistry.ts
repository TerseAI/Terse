import { Hydrator, Identifiable } from "./Hydrator";
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator";

/**
 * Registry of hydrators for converting SearchItems to hydrated objects.
 * Follows the same pattern as INPUT_REGISTRY and INTEGRATION_REGISTRY.
 */
export const HYDRATOR_REGISTRY: Hydrator<Identifiable>[] = [new RunHistoryRawEventHydrator()];


export function getHydrator(entityType: string): Hydrator<Identifiable> | undefined {
    return HYDRATOR_REGISTRY.find(h => h.entityType === entityType);
}
