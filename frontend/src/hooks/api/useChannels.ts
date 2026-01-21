import useSWR, { mutate, type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type {
    Agent,
    AgentsResponse,
    AgentUpdate,
} from '@/shared/types';
import { deserializeConfig } from '@/utility/ConfigUtils';

type AgentListArgs = {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
};

type UpdateAgentArgs = {
    id: string;
    data: AgentUpdate;
    mutateAgent?: KeyedMutator<Agent>;
};

type ListMutationContext = {
    params: AgentListArgs;
    mutateList: KeyedMutator<AgentsResponse>;
};

const agentListKey = ({ page = 1, limit = 25, isActive, search }: AgentListArgs = {}): readonly [string, AgentListArgs] => [
    'agents',
    { page, limit, isActive, search },
];

const agentDetailKey = (id: string | null): readonly [string, { id: string }] | null => {
    if (!id) return null;
    return ['agent', { id }];
};

export function useChannels(params: AgentListArgs = {}) {
    const key = agentListKey(params);

    const { data, error, isValidating, mutate } = useSWR<AgentsResponse>(
        key,
        async () => {
            const { page = 1, limit = 25, isActive, search } = params;
            const response = await BackendProvider.getUserChannels(page, limit, isActive, search);
            // Deserialize configs from JSON to class instances
            return {
                ...response,
                agents: response.agents.map(agent => ({
                    ...agent,
                    inputs: agent.inputs.map(input => ({
                        ...input,
                        config: deserializeConfig(input.config)
                    })),
                    outputs: agent.outputs ? agent.outputs.map(output => ({
                        ...output,
                        config: deserializeConfig(output.config)
                    })) : [],
                    knowledgeBases: agent.knowledgeBases?.map(kb => ({
                        ...kb,
                        config: deserializeConfig(kb.config)
                    }))
                }))
            };
        },
        {
            keepPreviousData: true,
        },
    );

    return {
        channels: data?.agents ?? [],
        pagination: data?.pagination,
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}

export function useChannel(id: string | null) {
    const key = agentDetailKey(id);

    const { data, error, isValidating, mutate } = useSWR<Agent>(
        key,
        id ? async () => {
            const agent = await BackendProvider.getChannelById(id);
            // Deserialize configs from JSON to class instances
            return {
                ...agent,
                inputs: agent.inputs.map(input => ({
                    ...input,
                    config: deserializeConfig(input.config)
                })),
                outputs: agent.outputs ? agent.outputs.map(output => ({
                    ...output,
                    config: deserializeConfig(output.config)
                })) : [],
                knowledgeBases: agent.knowledgeBases?.map(kb => ({
                    ...kb,
                    config: deserializeConfig(kb.config)
                }))
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
    return mutate((key) => Array.isArray(key) && key[0] === 'agents');
}

function invalidateChannelDetail(id: string) {
    return mutate(agentDetailKey(id));
}

export function useChannelMutations() {
    const createChannel = async (data: AgentUpdate) => {
        const result = await BackendProvider.createChannel(data);
        await invalidateChannelLists();
        return result;
    };

    const updateChannel = async ({ id, data, mutateAgent }: UpdateAgentArgs) => {
        await BackendProvider.updateChannel(id, data);

        if (mutateAgent) {
            await mutateAgent();
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
        agent: Agent,
        listContext?: ListMutationContext,
    ) => {
        const newStatus = !agent.isActive;

        if (listContext) {
            const { mutateList, params } = listContext;

            await mutateList(
                async () => {
                    await BackendProvider.updateChannel(agent.id, { isActive: newStatus });
                    const { page = 1, limit = 25, isActive, search } = params;
                    const response = await BackendProvider.getUserChannels(page, limit, isActive, search);
                    // Deserialize configs from JSON to class instances
                    return {
                        ...response,
                        agents: response.agents.map(agent => ({
                            ...agent,
                            inputs: agent.inputs.map(input => ({
                                ...input,
                                config: deserializeConfig(input.config)
                            })),
                            outputs: agent.outputs ? agent.outputs.map(output => ({
                                ...output,
                                config: deserializeConfig(output.config)
                            })) : [],
                            knowledgeBases: agent.knowledgeBases?.map(kb => ({
                                ...kb,
                                config: deserializeConfig(kb.config)
                            }))
                        }))
                    };
                },
                {
                    optimisticData: (currentData?: AgentsResponse, displayedData?: AgentsResponse) => {
                        const snapshot = currentData ?? displayedData ?? {
                            agents: [],
                            pagination: {
                                page: params.page ?? 1,
                                limit: params.limit ?? 25,
                                total: 0,
                                totalPages: 1,
                            },
                        };

                        return {
                            ...snapshot,
                            agents: snapshot.agents.map((item) =>
                                item.id === agent.id ? { ...item, isActive: newStatus } : item,
                            ),
                        };
                    },
                    rollbackOnError: true,
                    revalidate: false,
                },
            );
        } else {
            await BackendProvider.updateChannel(agent.id, { isActive: newStatus });
        }

        await invalidateChannelDetail(agent.id);
        await invalidateChannelLists();

        return { ...agent, isActive: newStatus };
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

export type { AgentListArgs };

