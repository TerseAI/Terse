import { Hydrator } from "./Hydrator";
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator";

/**
 * Registry of hydrators for converting SearchItems to hydrated objects.
 * Follows the same pattern as INPUT_REGISTRY and INTEGRATION_REGISTRY.
 */
export const HYDRATOR_REGISTRY: Hydrator<any>[] = [new RunHistoryRawEventHydrator()];


export function getHydrator(entityType: string): Hydrator<any> | undefined {
    return HYDRATOR_REGISTRY.find(h => h.entityType === entityType);
}
