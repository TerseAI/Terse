// 1 credit = $0.001 of marked-up LLM spend.
// AKA: 0.1 cents / credit
export const CENTS_PER_CREDIT = 0.1

export function dollarsToCredits(markedUpCostMicros: bigint): number {
    // micros --> cents
    const cents = Number(markedUpCostMicros) / 10_000
    return Math.ceil(cents / CENTS_PER_CREDIT)
}
