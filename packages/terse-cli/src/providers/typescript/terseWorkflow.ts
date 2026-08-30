import type { CreateJobParameters, TerseJobContext } from "terse-sdk"
import { __buildJobStateAccessor, createSDKTrigger } from "terse-sdk"
import { runWithJobContext } from "terse-sdk/dist/runIdentity/jobContextStore.js"
import type { SerializedEvent } from "terse-types"

export async function shouldRunTerseWorkflow({ job, event, context }: { job: CreateJobParameters; event: SerializedEvent; context: TerseJobContext }): Promise<boolean> {
    const sdkEvent = createSDKTrigger(event)
    const state = __buildJobStateAccessor(job.states ?? [])
    return runWithJobContext(context, async () => !job.filter || (await job.filter(sdkEvent, state)))
}
