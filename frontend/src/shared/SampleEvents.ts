import { ConfigType } from "./Configs";
import { RunHistoryTrigger } from "./RunHistoryTypes";
import { SlackChannelType, FigmaCommentEventData } from "./types";

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

export interface SlackEventData {
    channelId: string;
    channelName?: string;
    userId: string;
    userName?: string;
    text: string;
    timestamp: string;
    threadTimestamp?: string;
    teamId: string;
    permalink?: string;
    channelType?: SlackChannelType;
    blocks?: any[];
    attachments?: any[];
    files?: any[];
}

export interface LinearEventData {
    action: 'create' | 'update' | 'remove';
    actor: {
        id: string;
        name: string;
        email: string;
        url: string;
        type: string;
    };
    createdAt: string;
    data: {
        id: string;
        createdAt: string;
        updatedAt: string;
        number: number;
        title: string;
        priority: number;
        sortOrder: number;
        prioritySortOrder: number;
        slaType: string;
        addedToTeamAt: string;
        trashed: boolean;
        labelIds: string[];
        teamId: string;
        previousIdentifiers: string[];
        stateId: string;
        reactionData: any[];
        priorityLabel: string;
        botActor?: string;
        identifier: string;
        url: string;
        subscriberIds: string[];
        state: {
            id: string;
            color: string;
            name: string;
            type: string;
        };
        team: {
            id: string;
            key: string;
            name: string;
        };
        labels: any[];
        description?: string;
        descriptionData?: string;
        assignee?: {
            id: string;
            name: string;
        };
    };
    type: 'Issue' | 'Comment' | 'Project' | string;
    url?: string;
    organizationId: string;
    webhookTimestamp: number;
    webhookId: string;
}

export interface JiraEventData {
    timestamp: number;
    webhookEvent: string;
    issue_event_type_name?: string;
    user: {
        self: string;
        name: string;
        key: string;
        accountId?: string;
        emailAddress: string;
        avatarUrls: { "48x48": string; "24x24": string; "16x16": string; "32x32": string };
        displayName: string;
        active: boolean;
        timeZone?: string;
        locale?: string;
    };
    issue: {
        id: string;
        self: string;
        key: string;
        fields: {
            summary: string;
            description?: string;
            status: { name: string; id: string };
            priority: { name: string; id: string };
            issuetype: { name: string; id: string };
            project: { name: string; key: string; id: string };
            assignee?: any | null;
            created: string;
            updated: string;
            labels: string[];
            duedate?: string;
        };
    };
    changelog?: {
        id: string;
        items: Array<{
            field: string;
            fieldtype: string;
            fieldId?: string;
            from?: string;
            fromString?: string;
            to?: string;
            toString?: string;
        }>;
    };
    comment?: {
        self: string;
        id: string;
        author: any;
        body: string;
        created: string;
        updated: string;
    };
}

export interface GithubEventData {
    username: string;
    installationId: number;
    repositoryName: string;
    eventType: 'push' | 'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.closed' | 'pull_request.merged';
    branch?: string;
    commits: Array<{
        sha: string;
        name: string;
        fileDiffs: Array<{
            filename: string;
            diff: string;
        }>;
    }>;
    pullRequest?: {
        id: string;
        number: number;
        title: string;
        body?: string;
        state: 'open' | 'closed';
        merged: boolean;
        head: { ref: string; sha: string };
        base: { ref: string; sha: string };
        user: { login: string; email?: string };
    };
    repository: {
        id: number;
        name: string;
        owner: string;
        defaultBranch: string;
    };
    sender: {
        login: string;
        email?: string;
    };
}

// Common fields for all sample events
export type BaseSampleEvent = {
    trigger: RunHistoryTrigger;
    integrationId: string;
    // Standardized fields set by each integration's getSampleEvents
    timestamp: string; // ISO timestamp string
    preview: string;   // Human-readable preview of the event
}

export type GmailSampleEvent = BaseSampleEvent & {
    configType: ConfigType.GMAIL;
    eventData: GmailEventData;
}

export type SlackSampleEvent = BaseSampleEvent & {
    configType: ConfigType.SLACK;
    eventData: SlackEventData;
}

export type LinearSampleEvent = BaseSampleEvent & {
    configType: ConfigType.LINEAR_INPUT;
    eventData: LinearEventData;
}

export type JiraSampleEvent = BaseSampleEvent & {
    configType: ConfigType.JIRA;
    eventData: JiraEventData;
}

export type GithubSampleEvent = BaseSampleEvent & {
    configType: ConfigType.GITHUB;
    eventData: GithubEventData;
}

export type FigmaSampleEvent = BaseSampleEvent & {
    configType: ConfigType.FIGMA;
    eventData: FigmaCommentEventData;
}

// union type for all sample event data
export type SampleEvent =
    | GmailSampleEvent
    | SlackSampleEvent
    | LinearSampleEvent
    | JiraSampleEvent
    | GithubSampleEvent
    | FigmaSampleEvent;

export type AgentSampleEvent = {
    agentId: string;
    sampleEvent: SampleEvent;
}