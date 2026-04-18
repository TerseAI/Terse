import { Request, Response } from "express"
import { GetGithubRepositoriesForIntegrationResponse, User } from "terse-types"
import { GithubTrigger } from "terse-types"

import { EventProcessor } from "../../agent/AgentRunner/EventProcessor"
import { GithubTriggerRuntime } from "../../integrations/GithubIntegration"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { resolveUserForGithubInstallation } from "../github"

export async function processGithubEvent(event: GithubTrigger) {
    logger.info("processGithubEvent", { event })

    const user: User | null = await resolveUserForGithubInstallation(event.installationId, event.username)

    if (!user) {
        return null
    }

    const githubEvent = new GithubTriggerRuntime(event)
    const eventProcessor = new EventProcessor(githubEvent, user)
    const results = await eventProcessor.process()

    return results
}
