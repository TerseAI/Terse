import { RemoteWebhookJobExecutor } from "./RemoteWebhookJobExecutor"
import { SandboxJobExecutor } from "./SandboxJobExecutor"
import { JobExecutionKind, JobExecutor } from "./types"

class JobExecutorRegistry {
    constructor(private readonly executors: readonly JobExecutor[]) {}

    resolve(kind: JobExecutionKind): JobExecutor {
        const match = this.executors.find(executor => executor.kind === kind)
        if (!match) {
            throw new Error(`No job executor registered for kind: ${kind}`)
        }

        return match
    }
}

export const jobExecutorRegistry = new JobExecutorRegistry([new SandboxJobExecutor(), new RemoteWebhookJobExecutor()])
