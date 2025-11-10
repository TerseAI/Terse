import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { SlackChannel, SlackChannelsResponse } from '@/shared/types';
import { slackChannelsKey } from '@/shared/InvalidationKeys';

type UseSlackChannelsReturn = {
    channels: SlackChannel[];
    response: SlackChannelsResponse | undefined;
    selectedChannelId: string | null | undefined;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<SlackChannelsResponse>;
};

export function useSlackChannels(integrationId: string | null | undefined): UseSlackChannelsReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<SlackChannelsResponse>(
        slackChannelsKey(integrationId),
        integrationId ? () => BackendProvider.getSlackChannels(integrationId) : null,
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    const loading = Boolean(integrationId) && (isLoading || (!data && !error));

    return {
        channels: data?.channels ?? [],
        response: data,
        selectedChannelId: data?.selectedChannelId,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}


