export interface ConfigInstance { }


export type GmailConfig = {
    // Currently empty, but typed for future extensibility
  };
  
  export type FigmaConfig = {
    fileKey: string;
    fileName: string; // Optional display name
    teamId: string; // Figma team ID (required for webhook creation)
  };

// Typed config per integration type
export interface SlackConfig extends ConfigInstance {
    channelId?: string;
    channelName?: string;
    listenToUserDms?: boolean;
};

export interface NotionConfig extends ConfigInstance {
    databaseId?: string;
    databaseName?: string;
}

export interface NotionPageConfig extends ConfigInstance {
    pageId?: string;
    pageName?: string;
}

export interface LinearConfig extends ConfigInstance {
    projectId?: string;
    projectName?: string;
}

export interface JiraConfig extends ConfigInstance {
    projectKey?: string;
    projectId?: string;
}

export interface ConfluenceConfig extends ConfigInstance {
    spaceName: string;
    spaceId: string;
    pageId: string; // Page ID (required for outputs - specific page to write to)
    pageName: string; // Page display name (for UI, optional)
};

export type GitHubConfig = {
    repositoryIds: number[];
    // Note: owner and name not needed - they're part of repository identity
    // Future: branch, path filters
  };