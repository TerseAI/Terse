import { IntegrationType } from "terse-types"

import { IntegrationModule } from "../IntegrationModule.js"

/**
 * The built-in pseudo-integration: platform-native tools, the web/imageEdit/memory
 * skills, and the cron/webhook/webMonitor triggers. Always active, never connected.
 */
export class TerseModule extends IntegrationModule<undefined, undefined> {
    readonly type = IntegrationType.TERSE
    readonly summaryLabel = "Terse"
    protected readonly sectionImports = [
        "TimeTriggerConfig",
        "ActorClass",
        "DurableObjectInputConfig",
        "Timezone",
        "WebConfig",
        "ImageEditConfig",
        "MemoryConfig",
        "TypedSkill",
        "WebhookInputConfig",
        "TypedTrigger",
        "WebMonitorConfig",
        "FrequencyUnit",
        "InferStructuredOutput"
    ]

    async fetchInstances(): Promise<undefined[]> {
        return []
    }

    instanceId(): string {
        return ""
    }

    protected get requiresInstance(): boolean {
        return false
    }

    protected get hasTriggers(): boolean {
        return true
    }

    protected get triggerBucket(): string {
        return "common"
    }

    protected get triggersAggregateLines(): readonly string[] {
        return [
            "    /** Built-in: run on a cron schedule */",
            "    schedule: scheduleTriggers,",
            "    /** Built-in: trigger via an external HTTP request to a generated URL */",
            "    webhook: webhookTriggers,",
            "    /** Built-in: trigger when a durable object accepts a WebSocket message */",
            "    durableObject: durableObjectTriggers,",
            "    /** Built-in: trigger when a query against the live web matches a schema */",
            "    webMonitor: webMonitorTriggers,"
        ]
    }

    protected get skillsAggregateLines(): readonly string[] {
        return [
            "    /** Web — built-in web search, page extraction, and multi-source research */",
            "    web: webSkill,",
            "    /** ImageEdit — edit and generate images */",
            "    imageEdit: imageEditSkill,",
            "    /** Memory — built-in persistent memory scoped to this job, surviving across runs */",
            "    memory: memorySkill,"
        ]
    }

    protected prepareSection(): undefined {
        return undefined
    }
}
