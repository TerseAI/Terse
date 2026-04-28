import { db } from "../prismaClient"

const THRESHOLDS = [75, 90, 100, 200] as const

export type ThresholdEvent = {
    threshold: (typeof THRESHOLDS)[number]
    consumedCredits: number
    includedCredits: number
    overageMode: "soft" | "strict"
}

export async function evaluateAndRecordThresholds(
    orgId: string,
    consumedBefore: number,
    consumedAfter: number,
    summary: { includedCredits: number; hardCap: number; overageMode: "soft" | "strict" }
): Promise<ThresholdEvent[]> {
    const crossed: ThresholdEvent[] = []

    for (const threshold of THRESHOLDS) {
        const target = threshold === 200 ? summary.hardCap : Math.floor((threshold / 100) * summary.includedCredits)
        if (target > 0 && consumedBefore < target && consumedAfter >= target) {
            crossed.push({
                threshold,
                consumedCredits: consumedAfter,
                includedCredits: summary.includedCredits,
                overageMode: summary.overageMode
            })
        }
    }

    if (crossed.length === 0) return []

    const period = await db().billing_period_consumption.findUnique({ where: { organization_id: orgId } })
    if (!period) return []

    const existing = new Set(period.notified_thresholds)
    const fresh = crossed.filter(event => !existing.has(event.threshold))
    if (fresh.length === 0) return []

    await db().billing_period_consumption.update({
        where: { organization_id: orgId },
        data: { notified_thresholds: { push: fresh.map(event => event.threshold) } }
    })

    return fresh
}
