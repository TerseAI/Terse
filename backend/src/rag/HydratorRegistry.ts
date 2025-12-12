import { Hydrator, Identifiable, WithIdentity } from "./Hydrator";
import { RunHistoryRawEventHydrator } from "./runHistoryRag/hydrator";

/**
 * Registry of hydrators for converting SearchItems to hydrated objects.
 * Follows the same pattern as INPUT_REGISTRY and INTEGRATION_REGISTRY.
 */
export const HYDRATOR_REGISTRY: Hydrator<WithIdentity<any>>[] = [new RunHistoryRawEventHydrator()];


export function getHydrator<T>(entityType: string): Hydrator<WithIdentity<T>> | undefined {
    return HYDRATOR_REGISTRY.find(h => h.entityType === entityType);
}
