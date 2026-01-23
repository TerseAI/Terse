import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';
import type {
    GetToolsThatRequireApprovalsRequest,
    GetToolsThatRequireApprovalsResponse,
    TerseTool,
} from '@/shared/ToolsTypes';

const toolsKey = (request: GetToolsThatRequireApprovalsRequest | null): readonly [string, GetToolsThatRequireApprovalsRequest] | null => {
    if (!request || request.skills.length === 0) {
        return null;
    }
    return ['tools-that-require-approvals', request];
};

export function useToolsThatRequireApprovals(request: GetToolsThatRequireApprovalsRequest | null) {
    const key = toolsKey(request);

    const { data, error, isValidating } = useSWR<GetToolsThatRequireApprovalsResponse>(
        key,
        request ? async () => {
            return await BackendProvider.getToolsThatRequireApprovals(request);
        } : null,
    );

    return {
        tools: (data?.tools ?? []) as TerseTool[],
        isLoading: request !== null && !data && !error,
        isError: error,
        isValidating,
    };
}
