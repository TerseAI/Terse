import { AsyncLocalStorage } from "node:async_hooks"

import type { TerseJobContext } from "../context.js"

declare global {
    // eslint-disable-next-line no-var
    var __terseJobContextStore: AsyncLocalStorage<TerseJobContext> | undefined
}

function store(): AsyncLocalStorage<TerseJobContext> {
    return (globalThis.__terseJobContextStore ??= new AsyncLocalStorage<TerseJobContext>())
}

export function runWithJobContext<T>(ctx: TerseJobContext, fn: () => T | Promise<T>): T | Promise<T> {
    return store().run(ctx, fn)
}

export function getJobContext(): TerseJobContext | undefined {
    return store().getStore()
}
