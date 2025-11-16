import useSWR, { mutate, type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type {
    Automation,
    AutomationInput,
    AutomationOutput,
    AutomationPrompt,
    AutomationsResponse,
    AutomationUpdate,
    AutomationVersionsResponse,
} from '@/shared/types';

type AutomationListArgs = {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
};

type CreateAutomationArgs = {
    name: string;
    inputs: AutomationInput[];
    output: AutomationOutput | undefined;
    prompt: AutomationPrompt;
    isActive?: boolean;
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
            return BackendProvider.getUserAutomations(page, limit, isActive, search);
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
        id ? () => BackendProvider.getAutomationById(id) : null,
    );

    return {
        automation: data,
        isLoading: !!id && !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}

const automationVersionsKey = (id: string | null): readonly [string, { id: string }] | null => {
    if (!id) return null;
    return ['automationVersions', { id }];
};

export function useAutomationVersions(id: string | null) {
    const key = automationVersionsKey(id);

    const { data, error, isValidating, mutate } = useSWR<AutomationVersionsResponse>(
        key,
        id ? () => BackendProvider.getAutomationVersions(id) : null,
    );

    return {
        versions: data?.versions ?? [],
        automationId: data?.automationId,
        automationName: data?.automationName,
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
    const createAutomation = async ({ name, inputs, output, prompt, isActive }: CreateAutomationArgs) => {
        const result = await BackendProvider.createAutomation(name, inputs, output, prompt, isActive);
        await invalidateAutomationLists();
        return result;
    };

    const updateAutomation = async ({ id, data, mutateAutomation, skipCacheUpdate }: UpdateAutomationArgs & { skipCacheUpdate?: boolean }) => {
        await BackendProvider.updateAutomation(id, data);

        // Skip cache updates during autosave to prevent re-renders that close modals
        if (skipCacheUpdate) {
            return;
        }

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
                    return BackendProvider.getUserAutomations(page, limit, isActive, search);
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

    const publishAutomation = async (id: string, mutateAutomation?: KeyedMutator<Automation>) => {
        await BackendProvider.publishAutomation(id);

        if (mutateAutomation) {
            await mutateAutomation();
        } else {
            await invalidateAutomationDetail(id);
        }

        // Invalidate versions cache
        await mutate(automationVersionsKey(id));
        await invalidateAutomationLists();
    };

    return {
        createAutomation,
        updateAutomation,
        deleteAutomation,
        toggleAutomationActive,
        publishAutomation,
        invalidateAutomationLists,
        invalidateAutomationDetail,
    };
}

export type { AutomationListArgs };

