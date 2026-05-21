import { GithubTrigger, GithubTriggerSchema, IntegrationType } from "terse-types"
import { z } from "zod"

const fileDiffIngressSchema = z.object({
    filename: z.string(),
    diff: z.string()
})

const commitIngressSchema = z.object({
    sha: z.string(),
    name: z.string(),
    fileDiffs: z.array(fileDiffIngressSchema)
})

const pullRequestRefIngressSchema = z.object({
    ref: z.string(),
    sha: z.string()
})

const pullRequestUserIngressSchema = z.object({
    login: z.string(),
    email: z.string().nullable().optional()
})

const pullRequestIngressSchema = z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    state: z.enum(["open", "closed"]),
    merged: z.boolean(),
    head: pullRequestRefIngressSchema,
    base: pullRequestRefIngressSchema,
    user: pullRequestUserIngressSchema
})

const repositoryIngressSchema = z.object({
    id: z.number(),
    name: z.string(),
    owner: z.string(),
    defaultBranch: z.string()
})

const senderIngressSchema = z.object({
    login: z.string(),
    email: z.string().nullable().optional()
})

const githubUnifiedEventIngressBaseSchema = z.object({
    username: z.string(),
    installationId: z.number(),
    repositoryName: z.string(),
    repository: repositoryIngressSchema,
    sender: senderIngressSchema
})

const githubPushUnifiedEventIngressSchema = githubUnifiedEventIngressBaseSchema.extend({
    eventType: z.literal("push"),
    branch: z.string(),
    commits: z.array(commitIngressSchema)
})

const githubPullRequestUnifiedEventIngressSchema = githubUnifiedEventIngressBaseSchema.extend({
    eventType: z.enum(["pull_request.opened", "pull_request.synchronize", "pull_request.closed", "pull_request.merged"]),
    branch: z.string().optional(),
    commits: z.array(commitIngressSchema),
    pullRequest: pullRequestIngressSchema
})

const githubUnifiedEventIngressSchema = z.discriminatedUnion("eventType", [githubPushUnifiedEventIngressSchema, githubPullRequestUnifiedEventIngressSchema])

function toOptionalString(value: string | null | undefined): string | undefined {
    return value ?? undefined
}

export function parseGithubUnifiedEventPayload(payload: unknown): GithubTrigger {
    const rawEvent = githubUnifiedEventIngressSchema.parse(payload)

    return GithubTriggerSchema.parse({
        ...rawEvent,
        integrationType: IntegrationType.GITHUB,
        sender: {
            ...rawEvent.sender,
            email: toOptionalString(rawEvent.sender.email)
        },
        pullRequest:
            rawEvent.eventType === "push"
                ? undefined
                : {
                      ...rawEvent.pullRequest,
                      id: String(rawEvent.pullRequest.id),
                      body: toOptionalString(rawEvent.pullRequest.body),
                      user: {
                          ...rawEvent.pullRequest.user,
                          email: toOptionalString(rawEvent.pullRequest.user.email)
                      }
                  }
    })
}
