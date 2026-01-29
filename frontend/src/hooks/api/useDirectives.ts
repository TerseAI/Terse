import useSWR, { mutate } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { DirectiveRecord } from '@/shared/types';

const directivesKey = (agentId: string | null): readonly [string, { agentId: string }] | null => {
    if (!agentId) return null;
    return ['directives', { agentId }];
};

export function useDirectives(agentId: string | null) {
    const key = directivesKey(agentId);

    const { data, error, isValidating, mutate: mutateDirectives } = useSWR<DirectiveRecord[]>(
        key,
        agentId ? async () => {
            return BackendProvider.getAgentDirectives(agentId);
        } : null,
    );

    return {
        directives: data ?? [],
        isLoading: !!agentId && !data && !error,
        isError: error,
        isValidating,
        mutate: mutateDirectives,
    };
}

export function useDirectiveMutations() {
    const deleteDirective = async (agentId: string, directiveId: string) => {
        const result = await BackendProvider.deleteDirective(agentId, directiveId);
        // Invalidate the directives cache for this agent
        await mutate(directivesKey(agentId));
        return result;
    };

    return {
        deleteDirective,
    };
}
