import useSWR from "swr"
import { apiTokensKey } from "terse-types"
import { ApiToken } from "terse-types"

import { BackendProvider } from "../../services/backend"

export function useApiTokens() {
    const key = apiTokensKey()

    const { data, error, isValidating, mutate } = useSWR<ApiToken[]>(key, async () => {
        return BackendProvider.getApiTokens()
    })

    return { apiTokens: data, isError: error, isValidating, mutate }
}
