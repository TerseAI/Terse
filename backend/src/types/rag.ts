import { RunHistoryRawEventWithRelations } from './prisma';
import { IdentifiableRunHistoryRawEvent } from '../rag/runHistoryRag/hydrator';
import { SlackEvent } from '../integrations/SlackIntegration';
import logger from '../logger';

export enum HydratorType {
    RUN_HISTORY_RAW_EVENT = 'run_history_raw_event',
    SLACK_MESSAGE_EVENT = 'slack_message_event',
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
        logger.error(`Unknown HydratorType: ${value}`);
        throw new Error(`Unknown HydratorType: ${value}`);
    }
    return value;
}

export type HydratorTypeMap = {
    [HydratorType.RUN_HISTORY_RAW_EVENT]: IdentifiableRunHistoryRawEvent;
    [HydratorType.SLACK_MESSAGE_EVENT]: SlackEvent;
};

export enum RAGNamespace {
    RUN_HISTORY_MEMORY = 'run_history_memory',
}

export type NamespaceToHydratorTypes = {
    [RAGNamespace.RUN_HISTORY_MEMORY]: HydratorType.RUN_HISTORY_RAW_EVENT;
};

export type NamespaceToHydratorType = {
    [N in RAGNamespace]: HydratorTypeMap[NamespaceToHydratorTypes[N]];
};