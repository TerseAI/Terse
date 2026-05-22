const POSIX_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

export function shellQuote(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`
}

export function shellQuoteArgs(args: readonly string[]): string {
    return args.map(shellQuote).join(" ")
}

export function assertValidEnvVarName(name: string): void {
    if (!POSIX_IDENTIFIER.test(name)) {
        throw new Error(`Invalid env var name: ${JSON.stringify(name)}`)
    }
}
