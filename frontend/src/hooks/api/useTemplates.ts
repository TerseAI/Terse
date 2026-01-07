import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type { ChannelTemplates, ChannelTemplate } from '@/shared/Templates';

export function useTemplates() {
    const { data, error, isValidating } = useSWR<ChannelTemplates>(
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

export type { ChannelTemplate, ChannelTemplates };
