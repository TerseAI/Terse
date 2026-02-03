import { Runner } from "@openai/agents-core"

type RunnerConfig = {
    agentId: string
    runId: string
    userId: string
    env: string
}

/**
 * Creates a new runner instance with the given configuration, enabling visibility into an agent run in the UI.
 * @param config - The configuration for the runner.
 * @returns
 */
export function runnerFactory(config: RunnerConfig): Runner {
    return new Runner({
        traceMetadata: {
            agentId: config.agentId,
            runId: config.runId,
            userId: config.userId,
            env: config.env
        }
    })
}
