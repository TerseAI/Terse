import useSWR, { mutate, type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type {
    Automation,
    AutomationsResponse,
    AutomationUpdate,
} from '@/shared/types';
import { deserializeConfig } from '@/utility/ConfigUtils';

type AutomationListArgs = {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
};

type UpdateAutomationArgs = {
    id: string;
    data: AutomationUpdate;
    mutateAutomation?: KeyedMutator<Automation>;
};

type ListMutationContext = {
    params: AutomationListArgs;
    mutateList: KeyedMutator<AutomationsResponse>;
};

const automationListKey = ({ page = 1, limit = 25, isActive, search }: AutomationListArgs = {}): readonly [string, AutomationListArgs] => [
    'automations',
    { page, limit, isActive, search },
];

const automationDetailKey = (id: string | null): readonly [string, { id: string }] | null => {
    if (!id) return null;
    return ['automation', { id }];
};

export function useAutomations(params: AutomationListArgs = {}) {
    const key = automationListKey(params);

    const { data, error, isValidating, mutate } = useSWR<AutomationsResponse>(
        key,
        async () => {
            const { page = 1, limit = 25, isActive, search } = params;
            const response = await BackendProvider.getUserAutomations(page, limit, isActive, search);
            // Deserialize configs from JSON to class instances
            return {
                ...response,
                automations: response.automations.map(automation => ({
                    ...automation,
                    inputs: automation.inputs.map(input => ({
                        ...input,
                        config: deserializeConfig(input.config)
                    })),
                    output: {
                        ...automation.output,
                        config: deserializeConfig(automation.output.config)
                    }
                }))
            };
        },
        {
            keepPreviousData: true,
        },
    );

    return {
        automations: data?.automations ?? [],
        pagination: data?.pagination,
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}

export function useAutomation(id: string | null) {
    const key = automationDetailKey(id);

    const { data, error, isValidating, mutate } = useSWR<Automation>(
        key,
        id ? async () => {
            const automation = await BackendProvider.getAutomationById(id);
            // Deserialize configs from JSON to class instances
            return {
                ...automation,
                inputs: automation.inputs.map(input => ({
                    ...input,
                    config: deserializeConfig(input.config)
                })),
                output: {
                    ...automation.output,
                    config: deserializeConfig(automation.output.config)
                }
            };
        } : null,
    );

    return {
        automation: data,
        isLoading: !!id && !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}

function invalidateAutomationLists() {
    return mutate((key) => Array.isArray(key) && key[0] === 'automations');
}

function invalidateAutomationDetail(id: string) {
    return mutate(automationDetailKey(id));
}

export function useAutomationMutations() {
    const createAutomation = async ({ name, inputs, output, prompt, isActive }: Omit<Automation, 'id'>) => {
        const result = await BackendProvider.createAutomation(name, inputs, output, prompt, isActive);
        await invalidateAutomationLists();
        return result;
    };

    const updateAutomation = async ({ id, data, mutateAutomation }: UpdateAutomationArgs) => {
        await BackendProvider.updateAutomation(id, data);

        if (mutateAutomation) {
            await mutateAutomation();
        } else {
            await invalidateAutomationDetail(id);
        }

        await invalidateAutomationLists();
    };

    const deleteAutomation = async (id: string) => {
        const result = await BackendProvider.deleteAutomation(id);
        await invalidateAutomationDetail(id);
        await invalidateAutomationLists();
        return result;
    };

    const toggleAutomationActive = async (
        automation: Automation,
        listContext?: ListMutationContext,
    ) => {
        const newStatus = !automation.isActive;

        if (listContext) {
            const { mutateList, params } = listContext;

            await mutateList(
                async () => {
                    await BackendProvider.updateAutomation(automation.id, { isActive: newStatus });
                    const { page = 1, limit = 25, isActive, search } = params;
                    const response = await BackendProvider.getUserAutomations(page, limit, isActive, search);
                    // Deserialize configs from JSON to class instances
                    return {
                        ...response,
                        automations: response.automations.map(automation => ({
                            ...automation,
                            inputs: automation.inputs.map(input => ({
                                ...input,
                                config: deserializeConfig(input.config)
                            })),
                            output: {
                                ...automation.output,
                                config: deserializeConfig(automation.output.config)
                            }
                        }))
                    };
                },
                {
                    optimisticData: (currentData?: AutomationsResponse, displayedData?: AutomationsResponse) => {
                        const snapshot = currentData ?? displayedData ?? {
                            automations: [],
                            pagination: {
                                page: params.page ?? 1,
                                limit: params.limit ?? 25,
                                total: 0,
                                totalPages: 1,
                            },
                        };

                        return {
                            ...snapshot,
                            automations: snapshot.automations.map((item) =>
                                item.id === automation.id ? { ...item, isActive: newStatus } : item,
                            ),
                        };
                    },
                    rollbackOnError: true,
                    revalidate: false,
                },
            );
        } else {
            await BackendProvider.updateAutomation(automation.id, { isActive: newStatus });
        }

        await invalidateAutomationDetail(automation.id);
        await invalidateAutomationLists();

        return { ...automation, isActive: newStatus };
    };

    return {
        createAutomation,
        updateAutomation,
        deleteAutomation,
        toggleAutomationActive,
        invalidateAutomationLists,
        invalidateAutomationDetail,
    };
}

export type { AutomationListArgs };

