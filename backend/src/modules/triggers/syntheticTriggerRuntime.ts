import { type Trigger } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { TriggerRuntime } from "../../integrations/abstract/TriggerRuntime"
import { buildGithubTriggerMetadata } from "../../integrations/github/integration"
import { AgentTriggerWithConfigs } from "../../types/prisma"

/**
 * Wraps a fully-formed Trigger (from a sample event, manual trigger, or `terse test`) so it can be
 * fed to EventProcessor.processSingleAgent / triggerSingleAgent. It does not match agents, so it must
 * never be routed through EventProcessor.process().
 */
export class SyntheticTriggerRuntime extends TriggerRuntime<Trigger> {
    readonly integrationType: Trigger["integrationType"]
    readonly data: Trigger

    constructor(event: Trigger) {
        super()
        this.data = event
        this.integrationType = event.integrationType
    }

    matchesAgentTrigger(_agentTrigger: AgentTriggerWithConfigs): boolean {
        throw new Error("SyntheticTriggerRuntime must not be routed through EventProcessor.process(); use processSingleAgent")
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // TODO: Make this a method on the TriggerRuntime class and use it for all integrations
        // Delegate to the same metadata builders that real webhook-delivered runtimes use,
        // so sample-event runs show rich titles (e.g. "#482 Fix something") instead of the
        // bare `debugLog()` string. Fall back to a generic manual-sample shape for
        // integrations we haven't extracted yet.
        if (this.data.eventType !== "manual_sample" && this.data.integrationType === IntegrationType.GITHUB) {
            return buildGithubTriggerMetadata(this.data)
        }

        return {
            event: "manual_sample",
            integration: this.integrationType,
            source: "Manual trigger with sample event",
            title: this.debugLog()
        }
    }
}
