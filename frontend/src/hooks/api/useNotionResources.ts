import useSWR, { type KeyedMutator } from 'swr';
import { BackendProvider } from '@/services/backend';
import type { NotionResource, NotionResourcesResponse, NotionResourceType} from '@/shared/types';
import { notionResourcesKey } from "@/shared/InvalidationKeys";

type UseNotionResourcesReturn = {
    resources: NotionResource[];
    response: NotionResourcesResponse | undefined;
    selectedResourceId: string | null | undefined;
    selectedResourceType: NotionResourcesResponse['selectedResourceType'] | undefined;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isValidating: boolean;
    mutate: KeyedMutator<NotionResourcesResponse>;
};

export function useNotionResources(integrationId: string | null | undefined, resourceType?: NotionResourceType): UseNotionResourcesReturn {
    const { data, error, isLoading, isValidating, mutate } = useSWR<NotionResourcesResponse>(
        notionResourcesKey(integrationId),
        integrationId ? () => BackendProvider.getNotionResources(integrationId) : null,
        {
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
        },
    );

    const loading = Boolean(integrationId) && (isLoading || (!data && !error));
    const resources = resourceType ? data?.resources.filter((resource) => resource.type === resourceType) ?? [] : data?.resources ?? [];

    return {
        resources: resources,
        response: data,
        selectedResourceId: data?.selectedResourceId,
        selectedResourceType: data?.selectedResourceType,
        isLoading: loading,
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}


