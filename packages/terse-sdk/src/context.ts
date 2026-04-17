import { AsyncLocalStorage } from "node:async_hooks"

export type TerseJobContext = {
    sessionId: string
    runId: string
    apiBaseUrl: string
}

const store = new AsyncLocalStorage<TerseJobContext>()

export function runWithJobContext<T>(ctx: TerseJobContext, fn: () => T | Promise<T>): T | Promise<T> {
    return store.run(ctx, fn)
}

export function getJobContext(): TerseJobContext | undefined {
    return store.getStore()
}
