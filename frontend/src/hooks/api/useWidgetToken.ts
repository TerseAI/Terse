import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { widgetTokenKey } from '@/shared/InvalidationKeys';

type WidgetTokenData = { token: string; expiresAt: string };

export function useWidgetToken() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<WidgetTokenData>(
        widgetTokenKey(),
        () => BackendProvider.getWidgetToken(),
        { revalidateOnFocus: false },
    );

    return {
        token: data?.token ?? null,
        expiresAt: data?.expiresAt ?? null,
        isLoading: isLoading || (!data && !error),
        isError: Boolean(error),
        error,
        isValidating,
        mutate,
    };
}
