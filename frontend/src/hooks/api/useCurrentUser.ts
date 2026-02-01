import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { currentUserKey } from '@/shared/InvalidationKeys';
import type { User } from '@/types/User';

export function useCurrentUser() {
    const { data, error, isLoading, mutate } = useSWR<User | null>(
        currentUserKey(),
        async () => {
            try {
                return await BackendProvider.getCurrentUser();
            } catch (error) {
                // Let 401 errors propagate for redirect handling
                throw error;
            }
        },
        { revalidateOnFocus: false },
    );

    return {
        user: data ?? null,
        isLoading,
        isError: Boolean(error),
        error,
        mutate,
    };
}
