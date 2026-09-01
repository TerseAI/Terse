import type { SdkDurableObjectEnvironment } from "terse-types"

const ENVIRONMENT_VARIABLES = ["DURABLE_OBJECT_TOKEN", "DURABLE_OBJECT_NAMESPACE_ID", "DURABLE_OBJECT_CONTROL_PLANE_URL"] as const

async function withDurableObjectEnvironment<T>(environment: SdkDurableObjectEnvironment | null | undefined, run: () => Promise<T>): Promise<T> {
    if (environment === undefined) return run()

    const previous = new Map(ENVIRONMENT_VARIABLES.map(name => [name, process.env[name]]))
    if (environment === null) {
        for (const name of ENVIRONMENT_VARIABLES) delete process.env[name]
    } else {
        process.env.DURABLE_OBJECT_TOKEN = environment.token
        process.env.DURABLE_OBJECT_NAMESPACE_ID = environment.namespaceId
        process.env.DURABLE_OBJECT_CONTROL_PLANE_URL = environment.controlPlaneUrl
    }

    try {
        return await run()
    } finally {
        for (const [name, value] of previous) {
            if (value === undefined) delete process.env[name]
            else process.env[name] = value
        }
    }
}

export { withDurableObjectEnvironment }
