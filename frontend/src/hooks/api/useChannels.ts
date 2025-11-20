import useSWR, { mutate, type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type {
    Channel,
    ChannelsResponse,
    ChannelUpdate,
} from '@/shared/types';
import { deserializeConfig } from '@/utility/ConfigUtils';

type ChannelListArgs = {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
};

type UpdateChannelArgs = {
    id: string;
    data: ChannelUpdate;
    mutateChannel?: KeyedMutator<Channel>;
};

type ListMutationContext = {
    params: ChannelListArgs;
    mutateList: KeyedMutator<ChannelsResponse>;
};

const channelListKey = ({ page = 1, limit = 25, isActive, search }: ChannelListArgs = {}): readonly [string, ChannelListArgs] => [
    'channels',
    { page, limit, isActive, search },
];

const channelDetailKey = (id: string | null): readonly [string, { id: string }] | null => {
    if (!id) return null;
    return ['channel', { id }];
};

export function useChannels(params: ChannelListArgs = {}) {
    const key = channelListKey(params);

    const { data, error, isValidating, mutate } = useSWR<ChannelsResponse>(
        key,
        async () => {
            const { page = 1, limit = 25, isActive, search } = params;
            const response = await BackendProvider.getUserChannels(page, limit, isActive, search);
            // Deserialize configs from JSON to class instances
            return {
                ...response,
                channels: response.channels.map(channel => ({
                    ...channel,
                    inputs: channel.inputs.map(input => ({
                        ...input,
                        config: deserializeConfig(input.config)
                    })),
                    output: {
                        ...channel.output,
                        config: deserializeConfig(channel.output.config)
                    }
                }))
            };
        },
        {
            keepPreviousData: true,
        },
    );

    return {
        channels: data?.channels ?? [],
        pagination: data?.pagination,
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}

export function useChannel(id: string | null) {
    const key = channelDetailKey(id);

    const { data, error, isValidating, mutate } = useSWR<Channel>(
        key,
        id ? async () => {
            const channel = await BackendProvider.getChannelById(id);
            // Deserialize configs from JSON to class instances
            return {
                ...channel,
                inputs: channel.inputs.map(input => ({
                    ...input,
                    config: deserializeConfig(input.config)
                })),
                output: {
                    ...channel.output,
                    config: deserializeConfig(channel.output.config)
                }
            };
        } : null,
    );

    return {
        channel: data,
        isLoading: !!id && !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}

function invalidateChannelLists() {
    return mutate((key) => Array.isArray(key) && key[0] === 'channels');
}

function invalidateChannelDetail(id: string) {
    return mutate(channelDetailKey(id));
}

export function useChannelMutations() {
    const createChannel = async ({ name, inputs, output, prompt, isActive }: Omit<Channel, 'id'>) => {
        const result = await BackendProvider.createChannel(name, inputs, output, prompt, isActive);
        await invalidateChannelLists();
        return result;
    };

    const updateChannel = async ({ id, data, mutateChannel }: UpdateChannelArgs) => {
        await BackendProvider.updateChannel(id, data);

        if (mutateChannel) {
            await mutateChannel();
        } else {
            await invalidateChannelDetail(id);
        }

        await invalidateChannelLists();
    };

    const deleteChannel = async (id: string) => {
        const result = await BackendProvider.deleteChannel(id);
        await invalidateChannelDetail(id);
        await invalidateChannelLists();
        return result;
    };

    const toggleChannelActive = async (
        channel: Channel,
        listContext?: ListMutationContext,
    ) => {
        const newStatus = !channel.isActive;

        if (listContext) {
            const { mutateList, params } = listContext;

            await mutateList(
                async () => {
                    await BackendProvider.updateChannel(channel.id, { isActive: newStatus });
                    const { page = 1, limit = 25, isActive, search } = params;
                    const response = await BackendProvider.getUserChannels(page, limit, isActive, search);
                    // Deserialize configs from JSON to class instances
                    return {
                        ...response,
                        channels: response.channels.map(channel => ({
                            ...channel,
                            inputs: channel.inputs.map(input => ({
                                ...input,
                                config: deserializeConfig(input.config)
                            })),
                            output: {
                                ...channel.output,
                                config: deserializeConfig(channel.output.config)
                            }
                        }))
                    };
                },
                {
                    optimisticData: (currentData?: ChannelsResponse, displayedData?: ChannelsResponse) => {
                        const snapshot = currentData ?? displayedData ?? {
                            channels: [],
                            pagination: {
                                page: params.page ?? 1,
                                limit: params.limit ?? 25,
                                total: 0,
                                totalPages: 1,
                            },
                        };

                        return {
                            ...snapshot,
                            channels: snapshot.channels.map((item) =>
                                item.id === channel.id ? { ...item, isActive: newStatus } : item,
                            ),
                        };
                    },
                    rollbackOnError: true,
                    revalidate: false,
                },
            );
        } else {
            await BackendProvider.updateChannel(channel.id, { isActive: newStatus });
        }

        await invalidateChannelDetail(channel.id);
        await invalidateChannelLists();

        return { ...channel, isActive: newStatus };
    };

    return {
        createChannel,
        updateChannel,
        deleteChannel,
        toggleChannelActive,
        invalidateChannelLists,
        invalidateChannelDetail,
    };
}

export type { ChannelListArgs };

