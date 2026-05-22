import { Request, Response } from "express"

import { DEFAULT_TIMEZONE, buildStatsResponse, isValidStatsInterval, isValidTimezone } from "./service"

export async function getStats(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const organizationId = user.organizationId
    if (!organizationId) {
        return res.status(400).json({ error: "Organization context is required" })
    }

    const requestedTimezone = req.query.tz as string | undefined
    const timezone = requestedTimezone && isValidTimezone(requestedTimezone) ? requestedTimezone : DEFAULT_TIMEZONE
    const requestedInterval = req.query.interval as string | undefined
    const interval = requestedInterval && isValidStatsInterval(requestedInterval) ? requestedInterval : undefined

    const response = await buildStatsResponse(organizationId, timezone, interval)
    res.json(response)
}
