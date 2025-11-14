import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { GetGithubRepositoriesForIntegrationResponse, Repository} from '@/shared/types';
import { githubRepositoriesKey } from "@/shared/InvalidationKeys";

type UseGithubResourcesReturn = {
    repositories: Repository[];
    response: GetGithubRepositoriesForIntegrationResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<GetGithubRepositoriesForIntegrationResponse>;
};

export function useGithubResources(): UseGithubResourcesReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<GetGithubRepositoriesForIntegrationResponse>(
        githubRepositoriesKey(),
        () => BackendProvider.getGithubRepositoriesForIntegration(),
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    const loading = (isLoading || (!data && !error));

    return {
        repositories: data?.repositories ?? [],
        response: data,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}