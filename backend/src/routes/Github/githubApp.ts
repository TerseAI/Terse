import { Request, Response } from "express"
import { GithubTriggerSchema } from "terse-types"

import { githubApp } from "../../config/settings"
import logger from "../../logger"

import { processGithubEvent } from "./githubEventProcessor"

// Get GitHub App installation URL
export async function getInstallationUrl(req: Request, res: Response) {
    try {
        const appName = githubApp.appName
        const clientId = githubApp.clientId
        const userId = req.session?.user?.id
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }
        const state = Buffer.from(userId).toString("base64")
        // Generate GitHub App installation URL with callback
        const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&target_type=repositories&state=${state}`

        res.json({
            installationUrl
        })
    } catch (error) {
        logger.error("Error generating installation URL:", { error })
        res.status(500).json({ message: "Failed to generate installation URL" })
    }
}

export async function githubAppUnifiedEvent(req: Request, res: Response) {
    const body = GithubTriggerSchema.parse(req.body)
    logger.info("githubAppUnifiedEvent", {
        eventType: body.eventType,
        repositoryName: body.repositoryName,
        username: body.username
    })

    try {
        await processGithubEvent(body)
        res.status(200).json({ message: "Event processed successfully" })
    } catch (error) {
        logger.error("Error processing GitHub event", {
            error,
            eventType: body.eventType,
            repositoryName: body.repositoryName,
            username: body.username
        })
        res.status(500).json({ error: "Failed to process GitHub event" })
    }
}

export default {
    getInstallationUrl,
    githubAppUnifiedEvent
}
