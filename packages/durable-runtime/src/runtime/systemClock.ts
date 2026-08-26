export const NativeDate = globalThis.Date

export function systemNow(): number {
    return NativeDate.now()
}

export function toIsoString(timestamp: number): string {
    return new NativeDate(timestamp).toISOString()
}
