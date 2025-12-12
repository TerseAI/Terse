import { RunHistoryRawEventWithRelations } from './prisma';
import { IdentifiableRunHistoryRawEvent } from '../rag/runHistoryRag/hydrator';

export enum HydratorType {
    RUN_HISTORY_RAW_EVENT = 'run_history_raw_event'
}

const HYDRATOR_TYPE_VALUES = new Set(Object.values(HydratorType));

export function isHydratorType(value: string): value is HydratorType {
    return HYDRATOR_TYPE_VALUES.has(value as HydratorType);
}

export function parseHydratorType(value: string): HydratorType | undefined {
    return isHydratorType(value) ? value : undefined;
}

export function requireHydratorType(value: string): HydratorType {
    if (!isHydratorType(value)) {
        console.error(`Unknown HydratorType: ${value}`);
        throw new Error(`Unknown HydratorType: ${value}`);
    }
    return value;
}

export type HydratorTypeMap = {
    [HydratorType.RUN_HISTORY_RAW_EVENT]: IdentifiableRunHistoryRawEvent;
};

export enum RAGNamespace {
    RUN_HISTORY_MEMORY = 'run_history_memory'
}

/**
 * Type mapping from RAGNamespace to the corresponding hydrator return type.
 * This ensures type safety when using TurboPufferSearch with a specific namespace.
 */
export type NamespaceToHydratorType = {
    [RAGNamespace.RUN_HISTORY_MEMORY]: RunHistoryRawEventWithRelations;
    // Add more mappings as new namespaces are added
};