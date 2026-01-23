

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

// union type for all sample event data
export type SampleEventData = GmailEventData;