export function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
    const value = args[key]
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}
