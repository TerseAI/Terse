import { Project, Ticket } from "./TicketSystem";

export type User = {
    id: string;
    email: string;
    display_name: string;
    github_username: string | null;
    is_placeholder: boolean;
};

export type SubActivity = {
    summary: string;
    commits: CommitAssociation[];
}

export type CommitAssociation = {
    sha: string;
    message: string;
    url: string;
}

export type ActivityEvent = {
    event_type: string;
    title: string;
    github_repository_owner_id: string;
    github_repository_name: string;
    created_at: Date;
    sub_activities: SubActivity[];
}

export type TicketActivityEvent = {
    ticket: Ticket;
    event_type: string;
    title: string;
}

export type ProjectActivityEvent = {
    project: Project;
    event_type: string;
    title: string;
}

export type GithubIntegration = {
    repositoryName: string;
};

export type LinearIntegration = {
    apiKey: string;
};

export type JiraIntegration = {
    apiKey: string;
    baseUrl: string;
    email: string;
};

export type SlackIntegration = {
    teamName: string;
};

export type GmailIntegration = {
    email: string;              // User's Gmail address
    historyId: string;          // For tracking changes since last sync
    watchExpiration: Date;      // When the watch needs to be renewed (max 7 days)
};

export type NotionIntegration = {
    integrationToken: string;
    databaseId: string;
};

export type NotionDatabase = {
    id: string;
    title: string;
    url: string;
};

export type NotionDatabasesResponse = {
    databases: NotionDatabase[];
    selectedDatabaseId: string | null;
};

export type IntegrationsStatus = {
    integrations: {
        github?: GithubIntegration;
        linear?: LinearIntegration;
        jira?: JiraIntegration;
        slack?: SlackIntegration;
        gmail?: GmailIntegration;
        notion?: NotionIntegration;
    };
};

export type AutomationInput = {
    integration: string;
};

export type AutomationOutput = {
    integration: string;
};

export type AutomationPrompt = {
    text: string;
};

export type Automation = {
    id: string;
    name: string;
    isActive: boolean;
    prompt?: AutomationPrompt;
    inputs: AutomationInput[];
    output?: AutomationOutput;
};