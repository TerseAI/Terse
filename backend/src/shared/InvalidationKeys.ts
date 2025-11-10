export const slackChannelsKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['slackChannels', integrationId] as const;
};

export const notionResourcesKey = (integrationId: string | null | undefined): readonly [string, string] | null => {
    if (!integrationId) {
        return null;
    }

    return ['notionResources', integrationId] as const;
};

export const runHistoryKey = (runId: string): readonly [string, string] => {
    return ['runHistory', runId] as const;
};