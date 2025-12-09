import { useEffect } from 'react';
import { type KeyedMutator } from 'swr';

/**
 * Hook to listen for OAuth success messages and trigger a refetch
 * @param mutate - The SWR mutate function to call when OAuth succeeds
 */
export function useOAuthSuccessListener<T = any>(mutate: KeyedMutator<T>, successCallback?: () => void) {
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'oauth-success') {
                mutate();
                successCallback?.();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [mutate]);
}

