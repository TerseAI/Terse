import useSWR from "swr"

import { BackendProvider } from "../../services/backend"
import { apiTokensKey } from "../../shared/InvalidationKeys"
import { ApiToken } from "../../shared/types"

export function useApiTokens() {
    const key = apiTokensKey()

    const { data, error, isValidating, mutate } = useSWR<ApiToken[]>(key, async () => {
        return BackendProvider.getApiTokens()
    })

    return { apiTokens: data, isError: error, isValidating, mutate }
}
