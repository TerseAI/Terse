import { TerseAgent, Terse as TerseClient, type WebhookTrigger } from "terse-sdk"

import { Webhook } from "./terse.generated"

const client = new TerseClient()

// ─── Job 1: Simple webhook trigger, no skills ───────────────────────────────
// Validates the minimal job shape: a single webhook trigger calling the agent.

await client.createJob({
    name: "Tell me a joke",
    triggers: [Webhook.onRequest()],
    skills: [],
    onTrigger: async (event: WebhookTrigger, Agent: TerseAgent) => {
        await Agent.runAndWait("Tell me a funny joke")
    }
})
