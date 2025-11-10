import type { GetRunHistoryParams } from './RunHistoryTypes';

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
    automationId: string | null | undefined,
    params: GetRunHistoryParams = {}
): readonly [string, string, GetRunHistoryParams] | null => {
    if (!automationId) {
        return null;
    }
    return ['runHistory', automationId, params] as const;
};