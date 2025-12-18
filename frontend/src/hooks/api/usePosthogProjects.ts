import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { PosthogProject, PosthogProjectsResponse } from '@/shared/types';

type UsePosthogProjectsReturn = {
    projects: PosthogProject[];
    response: PosthogProjectsResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<PosthogProjectsResponse>;
};

export function usePosthogProjects(
    integrationId: string | null | undefined,
    search: string | null | undefined
): UsePosthogProjectsReturn {
    const shouldFetch = Boolean(integrationId);
    
    // Include search in key so SWR refetches when it changes
    const swrKey = shouldFetch && integrationId ? ['posthog-projects', integrationId, search ?? ''] : null;
    
    const { data, error, isLoading, isValidating, mutate } = useSWR<PosthogProjectsResponse>(
        swrKey,
        shouldFetch ? () => BackendProvider.getPosthogProjects(integrationId!, search ?? undefined) : null,
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    const loading = shouldFetch && (isLoading || (!data && !error));

    return {
        projects: data?.projects ?? [],
        response: data,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}

