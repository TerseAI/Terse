import { createJob, slack, waitForInput } from "terse-sdk"
import { z } from "zod"

// Connect Meta Ads and Higgsfield, run `terse generate`, then fill the four
// constants below. Run a single probe with:
//   terse test "Probe: meta list ad accounts" --entry-file probes/metaAdsProbes.jobs.ts
//
// This file lives outside src/ on purpose: it references generated symbols that
// do not exist until those two integrations are connected, so keeping it here
// leaves `pnpm build` green in the meantime.
import { SlackChannel, Triggers, toolbox } from "../src/terse.generated"

const AD_ACCOUNT_ID = ""
const PAGE_ID = ""
const ADSET_ID = ""
const LANDING_URL = "https://useterse.ai"

// One job per tool so a single broken call can be run and read in isolation.
// Every probe logs its raw output rather than acting on it.

createJob({
    name: "Probe: meta list ad accounts",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    onTrigger: async () => {
        const result = await toolbox.metaAds.readCampaigns({ request: { action: "list_ad_accounts" } })
        console.log(JSON.stringify(result, null, 2))
    }
})

createJob({
    name: "Probe: meta list pages",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    onTrigger: async () => {
        const result = await toolbox.metaAds.readPages({ request: {} })
        console.log(JSON.stringify(result, null, 2))
    }
})

createJob({
    name: "Probe: meta list campaigns and adsets",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    onTrigger: async () => {
        const campaigns = await toolbox.metaAds.readCampaigns({ request: { action: "list_campaigns", adAccountId: AD_ACCOUNT_ID } })
        console.log(JSON.stringify(campaigns, null, 2))
        const adsets = await toolbox.metaAds.readCampaigns({ request: { action: "list_adsets", adAccountId: AD_ACCOUNT_ID } })
        console.log(JSON.stringify(adsets, null, 2))
    }
})

createJob({
    name: "Probe: meta ad-level insights with breakdowns",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    onTrigger: async () => {
        const result = await toolbox.metaAds.readInsights({
            request: { adAccountId: AD_ACCOUNT_ID, level: "ad", datePreset: "last_30d", breakdowns: ["publisher_platform"] }
        })
        console.log(`rows=${result.rows.length} truncated=${result.truncated}`)
        console.log(JSON.stringify(result.rows.slice(0, 5), null, 2))
    }
})

createJob({
    name: "Probe: meta read ads with creatives",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    onTrigger: async () => {
        const result = await toolbox.metaAds.readAds({ request: { adAccountId: AD_ACCOUNT_ID, limit: 10 } })
        console.log(JSON.stringify(result, null, 2))
    }
})

createJob({
    name: "Probe: higgsfield generate image",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    onTrigger: async () => {
        const result = await toolbox.higgsfield.generateImage({
            prompt: "A minimal product shot of a coffee tin on a concrete surface, soft daylight, editorial styling",
            size: "2048x1152",
            batchSize: 1
        })
        console.log(JSON.stringify(result, null, 2))
    }
})

// Exercises the full chain the customer use case depends on: generate, cache,
// show the image in Slack for approval, then create the ad only on approval.
createJob({
    name: "Probe: creative approval then create ad",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    durable: true,
    onTrigger: async () => {
        const generated = await toolbox.higgsfield.generateImage({
            prompt: "A minimal product shot of a coffee tin on a concrete surface, soft daylight, editorial styling",
            size: "2048x1152",
            batchSize: 1
        })
        const image = generated.images[0]
        if (!image) throw new Error("Higgsfield returned no image")

        const headline = "Coffee, without the ceremony"
        const message = "Single origin, ground to order, at your door on Thursday."

        const decision = await waitForInput({
            via: slack({ channel: SlackChannel.AllTerseInc.channelId }),
            prompt: "Approve this ad creative?",
            images: [{ url: image.url, altText: headline }],
            details: { Headline: headline, "Primary text": message, Destination: LANDING_URL },
            options: [
                { id: "approve", label: "Approve" },
                { id: "reject", label: "Reject", freeText: true }
            ]
        })

        if (decision.choice !== "approve") {
            console.log("Creative rejected:", decision.text)
            return
        }

        const created = await toolbox.metaAds.createAd({
            request: {
                adAccountId: AD_ACCOUNT_ID,
                adsetId: ADSET_ID,
                pageId: PAGE_ID,
                name: "Probe variant",
                message,
                headline,
                linkUrl: LANDING_URL,
                pictureUrl: image.url,
                callToAction: "SHOP_NOW",
                status: "PAUSED"
            }
        })
        console.log(JSON.stringify(created, null, 2))
    }
})

createJob({
    name: "Probe: meta pause then resume an ad",
    triggers: [Triggers.schedule.cron({ expression: "0 0 1 1 *" })],
    states: [{ key: "lastAdId", value: z.string().default("") }],
    onTrigger: async (_event, state) => {
        const adId = await state.get("lastAdId")
        if (!adId) {
            console.log("Set lastAdId state to an ad id created by the approval probe before running this.")
            return
        }
        console.log(JSON.stringify(await toolbox.metaAds.setStatus({ request: { entityType: "ad", entityId: adId, status: "PAUSED" } }), null, 2))
        console.log(JSON.stringify(await toolbox.metaAds.setStatus({ request: { entityType: "ad", entityId: adId, status: "ACTIVE" } }), null, 2))
    }
})
