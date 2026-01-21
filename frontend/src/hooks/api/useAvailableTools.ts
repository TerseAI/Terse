import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import { AvailableTool } from '@/components/Channels/ToolApprovalSelector';

export function useAvailableTools(integrationTypes: string[]) {
    const { data, error, isLoading, isValidating } = useSWR<AvailableTool[]>(
        integrationTypes.length > 0 ? ['available-tools', integrationTypes] : null,
        async () => {
            return await BackendProvider.getAvailableToolsForOutputs(integrationTypes);
        }
    );

    return {
        availableTools: data ?? [],
        isLoading: isLoading,
        isError: error,
        isValidating,
    };
}
