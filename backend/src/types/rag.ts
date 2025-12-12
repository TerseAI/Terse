import { RunHistoryRawEventWithRelations } from './prisma';

export enum HydratorType {
    RUN_HISTORY_RAW_EVENT = 'run_history_raw_event'
}

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