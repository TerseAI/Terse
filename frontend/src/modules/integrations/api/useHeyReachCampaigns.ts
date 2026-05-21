import useSWR from "swr"

import { BackendProvider } from "@/lib/http"

type HeyReachCampaign = { id: string; name: string }

type UseHeyReachCampaignsReturn = {
    campaigns: HeyReachCampaign[]
    isLoading: boolean
    isError: boolean
}

export function useHeyReachCampaigns(integrationId: string | null | undefined): UseHeyReachCampaignsReturn {
    const shouldFetch = Boolean(integrationId)
    const swrKey = shouldFetch && integrationId ? ["heyreach-campaigns", integrationId] : null

    const { data, error, isLoading } = useSWR<{ campaigns: HeyReachCampaign[] }>(swrKey, shouldFetch ? () => BackendProvider.getHeyReachCampaigns(integrationId!) : null, {
        keepPreviousData: true,
        revalidateOnFocus: false
    })

    return {
        campaigns: data?.campaigns ?? [],
        isLoading: shouldFetch && (isLoading || (!data && !error)),
        isError: Boolean(error)
    }
}
