import { GetRunHistoryParams } from "./RunHistoryTypes";

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

export const runHistoryKey = (
    automationId: string,
    params?: GetRunHistoryParams
): readonly [string, string, string] | readonly [string, string] => {
    if (!params || Object.keys(params).length === 0) {
        return ['runHistory', automationId] as const;
    }
    
    // Yea we may need to rethink how we do this. I think it may be better to just fetch all params and fiter on the client.
    // But I see why it as done this way. It makes more sense if you support text search.
    const sortedKeys = Object.keys(params).sort();
    const sortedParams: Record<string, any> = {};
    for (const key of sortedKeys) {
        const value = params[key as keyof GetRunHistoryParams];
        if (value !== undefined) {
            sortedParams[key] = value;
        }
    }
    const serializedParams = JSON.stringify(sortedParams);
    return ['runHistory', automationId, serializedParams] as const;
};