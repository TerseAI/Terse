import { AsyncLocalStorage } from "node:async_hooks"

export type TerseJobContext = {
    sessionId: string
    runId: string | null
    apiBaseUrl: string
}

// AsyncLocalStorage tracks context per *instance*. If multiple copies of this
// module get loaded in the same process (e.g. the CLI's `terse-sdk` + the
// user's `terse-sdk` loaded by `tsx`'s isolated loader), each copy would
// otherwise create its own instance and the context would not propagate.
// Pin the instance to a process-global symbol so every copy shares one store.
const STORE_KEY = Symbol.for("terse.jobContextStore")
type GlobalWithStore = typeof globalThis & {
    [STORE_KEY]?: AsyncLocalStorage<TerseJobContext>
}
const globalScope = globalThis as GlobalWithStore
const store: AsyncLocalStorage<TerseJobContext> = globalScope[STORE_KEY] ?? (globalScope[STORE_KEY] = new AsyncLocalStorage<TerseJobContext>())

export function runWithJobContext<T>(ctx: TerseJobContext, fn: () => T | Promise<T>): T | Promise<T> {
    return store.run(ctx, fn)
}

export function getJobContext(): TerseJobContext | undefined {
    return store.getStore()
}
