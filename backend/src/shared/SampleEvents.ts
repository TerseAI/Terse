import { ConfigType } from "./Configs";
import { RunHistoryTrigger } from "./RunHistoryTypes";

export interface GmailEventData {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string;
    date: string; // Header date string (for display)
    internalDate: string; // Gmail's internal timestamp (milliseconds since epoch)
    messageId: string;
    body: string;
    snippet: string;
    labelIds: string[];
}

export type GmailSampleEvent = {
    configType: ConfigType;
    eventData: GmailEventData;
    trigger: RunHistoryTrigger;
    integrationId: string;
}


// union type for all sample event data
export type SampleEvent = GmailSampleEvent;


export type AgentSampleEvent = {
    agentId: string;
    sampleEvent: SampleEvent;
}