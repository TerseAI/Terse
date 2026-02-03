import useSWR from "swr"

import { BackendProvider } from "../services/backend"
import { RunHistoryActionWithId } from "../shared/RunHistoryTypes"

const fetcher = (ids: string[]) => BackendProvider.getRunHistoryActions(ids)

export function useRunHistoryActions(actionIds: string[]) {
    const shouldFetch = actionIds && actionIds.length > 0

    const { data, error, isLoading } = useSWR<RunHistoryActionWithId[]>(
        shouldFetch ? [actionIds] : null,
        args => {
            // args is actionIds (string[]) because key is [actionIds]
            // SWR passes key contents as args
            return fetcher(args as unknown as string[])
        },
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false
        }
    )

    return {
        actions: data || [],
        isLoading,
        error
    }
}
