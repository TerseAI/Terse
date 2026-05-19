import useSWR, { type KeyedMutator, mutate } from "swr"
import { type AgentListArgs, agentDetailKey, agentListKey } from "terse-types/InvalidationKeys"
import type { Agent, AgentUpdate, AgentsResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

type UpdateAgentArgs = {
    id: string
    data: AgentUpdate
    mutateAgent?: KeyedMutator<Agent>
}

type ListMutationContext = {
    params: AgentListArgs
    mutateList: KeyedMutator<AgentsResponse>
}

export function useAgents(params: AgentListArgs = {}) {
    const key = agentListKey(params)

    const { data, error, isValidating, mutate } = useSWR<AgentsResponse>(
        key,
        async () => {
            const { page = 1, limit = 25, isActive, search } = params
            return BackendProvider.getUserAgents(page, limit, isActive, search)
        },
        {
            keepPreviousData: true
        }
    )

    return {
        agents: data?.agents ?? [],
        pagination: data?.pagination,
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}

export function useAgent(id: string | null) {
    const key = agentDetailKey(id)

    const { data, error, isValidating, mutate } = useSWR<Agent>(key, id ? async () => BackendProvider.getAgentById(id) : null)

    return {
        agent: data,
        isLoading: !!id && !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}

function invalidateAgentLists() {
    return mutate(key => Array.isArray(key) && key[0] === "agents")
}

function invalidateAgentDetail(id: string) {
    return mutate(agentDetailKey(id))
}

export function useAgentMutations() {
    const updateAgent = async ({ id, data, mutateAgent }: UpdateAgentArgs) => {
        await BackendProvider.updateAgent(id, data)

        if (mutateAgent) {
            await mutateAgent()
        } else {
            await invalidateAgentDetail(id)
        }

        await invalidateAgentLists()
    }

    const deleteAgent = async (id: string) => {
        const result = await BackendProvider.deleteAgent(id)
        await invalidateAgentDetail(id)
        await invalidateAgentLists()
        return result
    }

    const toggleAgentActive = async (agent: Agent, listContext?: ListMutationContext) => {
        const newStatus = !agent.isActive

        if (listContext) {
            const { mutateList, params } = listContext

            await mutateList(
                async () => {
                    await BackendProvider.updateAgent(agent.id, { isActive: newStatus })
                    const { page = 1, limit = 25, isActive, search } = params
                    return BackendProvider.getUserAgents(page, limit, isActive, search)
                },
                {
                    optimisticData: (currentData?: AgentsResponse, displayedData?: AgentsResponse) => {
                        const snapshot = currentData ??
                            displayedData ?? {
                                agents: [],
                                pagination: {
                                    page: params.page ?? 1,
                                    limit: params.limit ?? 25,
                                    total: 0,
                                    totalPages: 1
                                }
                            }

                        return {
                            ...snapshot,
                            agents: snapshot.agents.map(item => (item.id === agent.id ? { ...item, isActive: newStatus } : item))
                        }
                    },
                    rollbackOnError: true,
                    revalidate: false
                }
            )
        } else {
            await BackendProvider.updateAgent(agent.id, { isActive: newStatus })
        }

        await invalidateAgentDetail(agent.id)
        await invalidateAgentLists()

        return { ...agent, isActive: newStatus }
    }

    return {
        updateAgent,
        deleteAgent,
        toggleAgentActive,
        invalidateAgentLists,
        invalidateAgentDetail
    }
}
