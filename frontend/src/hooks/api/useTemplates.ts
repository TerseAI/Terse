import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type { ChannelTemplate } from '@/shared/types';

export function useTemplates() {
    const { data, error, isValidating } = useSWR<ChannelTemplate[]>(
        'templates',
        async () => {
            return BackendProvider.getTemplates();
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000, // Cache for 1 minute
        }
    );

    return {
        templates: data ?? [],
        isLoading: !data && !error,
        isError: error,
        isValidating,
    };
}

export type { ChannelTemplate };
