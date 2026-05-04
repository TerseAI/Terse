import * as z from "zod"

import { configDataSchema, configTypeEnum, skillConfigDataSchema, triggerConfigDataSchema } from "./Configs"
import { integrationTypeEnum } from "./Integrations"
import { runHistoryActionBaseSchema, runHistoryActionTypeSchema, runHistoryDecisionActionSchema, runHistoryStatusSchema } from "./RunHistoryTypes"
import type { RunHistoryAction } from "./RunHistoryTypes"
import { SlackChannelType, slackChannelTypeSchema } from "./SlackTypes"
import {
    attioAttributeSchema,
    attioObjectSchema,
    attioObjectWithAttributesSchema,
    attioRecordIdentifierSchema,
    attioRecordSchema,
    attioUpsertErrorSchema,
    linearProjectSummarySchema,
    linearTeamSchema,
    slackUserResponseSchema
} from "./Tools"
import { TriggerSchema, TriggerTypeSchema, serializedEventDisplaySchema, serializedEventSchema } from "./Triggers"

export const roleSchema = z.enum(["admin", "user"])
export type Role = z.infer<typeof roleSchema>

export const userSchema = z.object({
    id: z.string(),
    workosId: z.string(),
    organizationId: z.string(),
    organizationName: z.string(),
    email: z.string(),
    displayName: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    displayPhotoUrl: z.string(),
    roles: z.array(roleSchema)
})
export type User = z.infer<typeof userSchema>

export const userNoOrganizationSchema = userSchema.omit({
    organizationId: true,
    organizationName: true,
    roles: true
})
export type UserNoOrganization = z.infer<typeof userNoOrganizationSchema>

export const commitAssociationSchema = z.object({
    sha: z.string(),
    message: z.string(),
    url: z.string()
})
export type CommitAssociation = z.infer<typeof commitAssociationSchema>

export const subActivitySchema = z.object({
    summary: z.string(),
    commits: z.array(commitAssociationSchema)
})
export type SubActivity = z.infer<typeof subActivitySchema>

export const activityEventSchema = z.object({
    event_type: z.string(),
    title: z.string(),
    github_repository_owner_id: z.string(),
    github_repository_name: z.string(),
    created_at: z.date(),
    sub_activities: z.array(subActivitySchema)
})
export type ActivityEvent = z.infer<typeof activityEventSchema>

export type LinearTeam = z.infer<typeof linearTeamSchema>
export type LinearProjectSummary = z.infer<typeof linearProjectSummarySchema>
export type AttioObject = z.infer<typeof attioObjectSchema>
export type AttioAttribute = z.infer<typeof attioAttributeSchema>
export type AttioObjectWithAttributes = z.infer<typeof attioObjectWithAttributesSchema>
export type AttioRecordIdentifier = z.infer<typeof attioRecordIdentifierSchema>
export type AttioRecord = z.infer<typeof attioRecordSchema>

export const linearWorkspaceSchema = z.object({
    id: z.string(),
    name: z.string()
})
export type LinearWorkspace = z.infer<typeof linearWorkspaceSchema>

export const notionResourceTypeSchema = z.enum(["database", "page"])
export type NotionResourceType = z.infer<typeof notionResourceTypeSchema>

export const notionResourceSchema = z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    type: notionResourceTypeSchema
})
export type NotionResource = z.infer<typeof notionResourceSchema>

export const notionResourcesResponseSchema = z.object({
    resources: z.array(notionResourceSchema)
})
export type NotionResourcesResponse = z.infer<typeof notionResourcesResponseSchema>

export const posthogProjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    organization_id: z.string().optional()
})
export type PosthogProject = z.infer<typeof posthogProjectSchema>

export const posthogProjectsResponseSchema = z.object({
    projects: z.array(posthogProjectSchema)
})
export type PosthogProjectsResponse = z.infer<typeof posthogProjectsResponseSchema>

export const launchDarklyProjectSchema = z.object({
    key: z.string(),
    name: z.string()
})
export type LaunchDarklyProject = z.infer<typeof launchDarklyProjectSchema>

export const launchDarklyProjectsResponseSchema = z.object({
    projects: z.array(launchDarklyProjectSchema)
})
export type LaunchDarklyProjectsResponse = z.infer<typeof launchDarklyProjectsResponseSchema>

export const launchDarklyEnvironmentSchema = z.object({
    key: z.string(),
    name: z.string()
})
export type LaunchDarklyEnvironment = z.infer<typeof launchDarklyEnvironmentSchema>

export const launchDarklyEnvironmentsResponseSchema = z.object({
    environments: z.array(launchDarklyEnvironmentSchema)
})
export type LaunchDarklyEnvironmentsResponse = z.infer<typeof launchDarklyEnvironmentsResponseSchema>

export const datadogIndexSchema = z.object({
    id: z.string(),
    name: z.string(),
    isEnabled: z.boolean(),
    dailyLimit: z.number().int().optional(),
    retentionDays: z.number().int().optional()
})
export type DatadogIndex = z.infer<typeof datadogIndexSchema>

export const datadogIndexesResponseSchema = z.object({
    indexes: z.array(datadogIndexSchema)
})
export type DatadogIndexesResponse = z.infer<typeof datadogIndexesResponseSchema>

export const slackChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    isPrivate: z.boolean(),
    isArchived: z.boolean(),
    isMPIM: z.boolean()
})
export type SlackChannel = z.infer<typeof slackChannelSchema>

export const slackChannelsResponseSchema = z.object({
    channels: z.array(slackChannelSchema),
    selectedChannelId: z.string().nullable()
})
export type SlackChannelsResponse = z.infer<typeof slackChannelsResponseSchema>

export type SlackUserResponse = z.infer<typeof slackUserResponseSchema>

export const slackUsersResponseSchema = z.object({
    users: z.array(slackUserResponseSchema)
})
export type SlackUsersResponse = z.infer<typeof slackUsersResponseSchema>

export const TERSE_AGENT_MESSAGE_EVENT_TYPE = "terse_agent_message" as const

export const terseAgentMessageEventPayloadSchema = z.object({
    run_id: z.string(),
    automation_id: z.string(),
    organization_id: z.string()
})

export const terseAgentMessageMetadataSchema = z.object({
    event_type: z.literal(TERSE_AGENT_MESSAGE_EVENT_TYPE),
    event_payload: terseAgentMessageEventPayloadSchema
})
export type TerseAgentMessageMetadata = z.infer<typeof terseAgentMessageMetadataSchema>

export { SlackChannelType, slackChannelTypeSchema }

export const apiTokenSchema = z.object({
    id: z.string(),
    name: z.string(),
    tokenPrefix: z.string(),
    createdAt: z.string(),
    lastUsedAt: z.string().nullable()
})
export type ApiToken = z.infer<typeof apiTokenSchema>

export const apiTokenCreateResponseSchema = z.object({
    token: apiTokenSchema,
    rawToken: z.string()
})
export type ApiTokenCreateResponse = z.infer<typeof apiTokenCreateResponseSchema>

export const deviceTokenExchangeUserSchema = z.object({
    email: z.string(),
    firstName: z.string().nullable(),
    displayName: z.string().nullable()
})

export const deviceTokenExchangeResponseSchema = z.object({
    apiKey: z.string(),
    user: deviceTokenExchangeUserSchema
})
export type DeviceTokenExchangeResponse = z.infer<typeof deviceTokenExchangeResponseSchema>

const configInstanceDataSchema = configDataSchema

export const triggerMetadataSchema = z.object({
    webhookUrl: z.string().nullable().optional()
})
export type TriggerMetadata = z.infer<typeof triggerMetadataSchema>

export const agentTriggerSchema = z.object({
    id: z.string(),
    config: configInstanceDataSchema,
    metadata: triggerMetadataSchema.nullable().optional()
})
export type AgentTrigger = z.infer<typeof agentTriggerSchema>

export const agentOutputSchema = z.object({
    id: z.string(),
    config: configInstanceDataSchema
})
export type AgentOutput = z.infer<typeof agentOutputSchema>

export const agentPromptSchema = z.object({
    text: z.string()
})
export type AgentPrompt = z.infer<typeof agentPromptSchema>

export const transientAgentTriggerSchema = z.object({
    id: z.string(),
    config: configInstanceDataSchema.optional(),
    configType: configTypeEnum
})
export type TransientAgentTrigger = z.infer<typeof transientAgentTriggerSchema>

export const transientAgentOutputSchema = z.object({
    id: z.string(),
    config: configInstanceDataSchema.optional(),
    configType: configTypeEnum
})
export type TransientAgentOutput = z.infer<typeof transientAgentOutputSchema>

export const templateConfigRefSchema = z.object({
    configType: configTypeEnum,
    integrationType: integrationTypeEnum
})
export type TemplateConfigRef = z.infer<typeof templateConfigRefSchema>

export const templateTriggerSchema = z.object({
    config: templateConfigRefSchema
})
export type TemplateTrigger = z.infer<typeof templateTriggerSchema>

export const templateOutputSchema = z.object({
    config: templateConfigRefSchema
})
export type TemplateOutput = z.infer<typeof templateOutputSchema>

export const templateCategorySchema = z.enum(["ship", "users", "sync", "track"])
export type TemplateCategory = z.infer<typeof templateCategorySchema>

export const agentTemplateSchema = z.object({
    id: z.string(),
    category: templateCategorySchema,
    name: z.string(),
    description: z.string(),
    chatPrompt: z.string(),
    prompt: agentPromptSchema,
    triggers: z.array(templateTriggerSchema),
    outputs: z.array(templateOutputSchema),
    requireApproval: z.boolean(),
    isActive: z.boolean()
})
export type AgentTemplate = z.infer<typeof agentTemplateSchema>

export const runHistoryTriggerSchema = z.object({
    event: z.string(),
    integration: integrationTypeEnum,
    source: z.string(),
    title: z.string().optional(),
    subheader: z.string().optional(),
    url: z.string().optional()
})
export type RunHistoryTrigger = z.infer<typeof runHistoryTriggerSchema>

export type TriggerPayload = {
    triggerEvent: string | null
    triggerEventType: string | null
    isTriggerEventTruncated: boolean
}

export const runHistoryDecisionSchema = z.object({
    action: runHistoryDecisionActionSchema,
    reasoning: z.string()
})
export type RunHistoryDecision = z.infer<typeof runHistoryDecisionSchema>

export const runHistoryRecordSchema = z.object({
    id: z.string(),
    agentId: z.string(),
    timestamp: z.string(),
    trigger: runHistoryTriggerSchema,
    filtered: z.boolean(),
    decision: runHistoryDecisionSchema,
    actions: z.array(runHistoryActionBaseSchema).optional(),
    status: runHistoryStatusSchema,
    isManuallyTriggered: z.boolean()
})
export type RunHistoryRecord = z.infer<typeof runHistoryRecordSchema>

export const runHistoryRecordWithAgentSchema = runHistoryRecordSchema.extend({
    agentName: z.string()
})
export type RunHistoryRecordWithAgent = z.infer<typeof runHistoryRecordWithAgentSchema>

export const agentNotificationSettingsSchema = z.object({
    enabled: z.boolean(),
    actionTypes: z.array(runHistoryActionTypeSchema)
})
export type AgentNotificationSettings = z.infer<typeof agentNotificationSettingsSchema>

export const jobMetadataSchema = z.object({
    remoteServerUrl: z.string().nullable(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable()
})
export type JobMetadata = z.infer<typeof jobMetadataSchema>

export const agentSchema = z.object({
    id: z.string(),
    name: z.string(),
    isActive: z.boolean(),
    requireApproval: z.boolean(),
    prompt: agentPromptSchema,
    triggers: z.array(agentTriggerSchema),
    outputs: z.array(agentOutputSchema),
    createdByUserId: z.string(),
    notificationSettings: agentNotificationSettingsSchema.nullable(),
    toolApprovals: z.array(z.string()).nullable(),
    updatedAt: z.string().nullable(),
    source: z.enum(["WEB_UI", "SDK"]).nullable(),
    metadata: jobMetadataSchema.nullable()
})
export type Agent = z.infer<typeof agentSchema>

export const agentUpdateSchema = z.object({
    name: z.string().optional(),
    triggers: z.array(agentTriggerSchema).optional(),
    outputs: z.array(agentOutputSchema).optional(),
    prompt: agentPromptSchema.optional(),
    isActive: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    notificationSettings: agentNotificationSettingsSchema.nullable().optional(),
    toolApprovals: z.array(z.string()).nullable().optional()
})
export type AgentUpdate = z.infer<typeof agentUpdateSchema>

export const agentCreateSchema = agentSchema.omit({
    id: true,
    createdByUserId: true,
    source: true,
    updatedAt: true
})
export type AgentCreate = z.infer<typeof agentCreateSchema>

export const agentDraftSchema = agentCreateSchema.extend({
    id: z.string().nullable(),
    createdByUserId: z.string()
})
export type AgentDraft = z.infer<typeof agentDraftSchema>

export const paginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
})

export const agentsResponseSchema = z.object({
    agents: z.array(agentSchema),
    pagination: paginationSchema
})
export type AgentsResponse = z.infer<typeof agentsResponseSchema>

export const recentAgentSchema = agentSchema.extend({
    updatedAt: z.string(),
    lastEventProcessedAt: z.string().nullable()
})
export type RecentAgent = z.infer<typeof recentAgentSchema>

export const agentImprovementStatusSchema = z.enum(["PENDING", "APPLIED", "DISMISSED"])
export type AgentImprovementStatus = z.infer<typeof agentImprovementStatusSchema>

export const agentImprovementTargetAreaSchema = z.enum(["prompt", "trigger_config", "output_config", "general", "code"])
export type AgentImprovementTargetArea = z.infer<typeof agentImprovementTargetAreaSchema>

export const agentReviewSchema = z.object({
    id: z.string(),
    automationId: z.string(),
    title: z.string(),
    summary: z.string(),
    runsAnalyzed: z.number().int(),
    reviewPeriodStart: z.string(),
    reviewPeriodEnd: z.string(),
    createdAt: z.string()
})
export type AgentReview = z.infer<typeof agentReviewSchema>

export const agentImprovementSchema = z.object({
    id: z.string(),
    reviewId: z.string(),
    automationId: z.string(),
    title: z.string(),
    description: z.string(),
    targetArea: agentImprovementTargetAreaSchema,
    confidence: z.number(),
    status: agentImprovementStatusSchema,
    suggestedPatch: z.string().optional(),
    appliedPrompt: z.string().optional(),
    appliedAt: z.string().optional(),
    dismissedAt: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string()
})
export type AgentImprovement = z.infer<typeof agentImprovementSchema>

export const getAgentImprovementsResponseSchema = z.object({
    review: agentReviewSchema.nullable(),
    improvements: z.array(agentImprovementSchema),
    improvementsEnabled: z.boolean()
})
export type GetAgentImprovementsResponse = z.infer<typeof getAgentImprovementsResponseSchema>

export const applyImprovementResponseSchema = z.object({
    success: z.boolean(),
    appliedPrompt: z.string()
})
export type ApplyImprovementResponse = z.infer<typeof applyImprovementResponseSchema>

export const dismissImprovementResponseSchema = z.object({
    success: z.boolean()
})
export type DismissImprovementResponse = z.infer<typeof dismissImprovementResponseSchema>

export const toggleImprovementsEnabledResponseSchema = z.object({
    success: z.boolean(),
    improvementsEnabled: z.boolean()
})
export type ToggleImprovementsEnabledResponse = z.infer<typeof toggleImprovementsEnabledResponseSchema>

export const repositorySchema = z.object({
    name: z.string(),
    owner: z.string(),
    id: z.number().int()
})
export type Repository = z.infer<typeof repositorySchema>

export const githubAppInstallationCallbackRequestSchema = z.object({
    name: z.string(),
    email: z.string(),
    username: z.string(),
    installationId: z.number().int(),
    accountName: z.string().nullable(),
    repositories: z.array(repositorySchema)
})
export type GithubAppInstallationCallbackRequest = z.infer<typeof githubAppInstallationCallbackRequestSchema>

export const getGithubRepositoriesForIntegrationRequestSchema = z.object({})
export type GetGithubRepositoriesForIntegrationRequest = z.infer<typeof getGithubRepositoriesForIntegrationRequestSchema>

export const getGithubRepositoriesForIntegrationResponseSchema = z.object({
    repositories: z.array(repositorySchema)
})
export type GetGithubRepositoriesForIntegrationResponse = z.infer<typeof getGithubRepositoriesForIntegrationResponseSchema>

export const oauthInstallationDetailsSchema = z.object({
    oauthUrl: z.string()
})
export type OAuthInstallationDetails = z.infer<typeof oauthInstallationDetailsSchema>

export const formFieldTypeSchema = z.enum(["text", "password", "textarea"])
export type FormFieldType = z.infer<typeof formFieldTypeSchema>

export const formFieldDefinitionSchema = z.object({
    name: z.string(),
    type: formFieldTypeSchema,
    label: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    hint: z.string().optional()
})
export type FormFieldDefinition = z.infer<typeof formFieldDefinitionSchema>

export const formIntegrationSetupSchema = z.object({
    title: z.string(),
    url: z.string(),
    instructions: z.array(z.string())
})
export type FormIntegrationSetup = z.infer<typeof formIntegrationSetupSchema>

export const configurationFieldTypeSchema = z.enum(["radio", "select"])
export type ConfigurationFieldType = z.infer<typeof configurationFieldTypeSchema>

export const configurationOptionSchema = z.object({
    label: z.string(),
    value: z.string()
})
export type ConfigurationOption = z.infer<typeof configurationOptionSchema>

export const configurationFieldDefinitionSchema = z.object({
    name: z.string(),
    type: configurationFieldTypeSchema,
    label: z.string(),
    options: z.array(configurationOptionSchema),
    required: z.boolean().optional(),
    hint: z.string().optional()
})
export type ConfigurationFieldDefinition = z.infer<typeof configurationFieldDefinitionSchema>

export const integrationFieldsResponseSchema = z.object({
    installationType: z.enum(["form", "oauth"]),
    fields: z.union([z.array(formFieldDefinitionSchema), z.array(configurationFieldDefinitionSchema)]),
    setup: formIntegrationSetupSchema.optional()
})
export type IntegrationFieldsResponse = z.infer<typeof integrationFieldsResponseSchema>

export const statsIntervalSchema = z.enum(["1h", "24h", "7d", "1mo", "3mo", "1y"])
export type StatsInterval = z.infer<typeof statsIntervalSchema>

export const dailyEventCountSchema = z.object({
    date: z.string(),
    events: z.number().int()
})
export type DailyEventCount = z.infer<typeof dailyEventCountSchema>

export const recentActionSchema = z.object({
    action: z.string(),
    integration: integrationTypeEnum,
    target: z.string(),
    details: z.string(),
    url: z.string().optional(),
    timestamp: z.string(),
    agentName: z.string(),
    type: runHistoryActionTypeSchema
})
export type RecentAction = z.infer<typeof recentActionSchema>

export const agentActivityItemSchema = z.object({
    agentId: z.string(),
    agentName: z.string(),
    runCount: z.number().int()
})
export type AgentActivityItem = z.infer<typeof agentActivityItemSchema>

export const countByStringSchema = z.object({
    label: z.string(),
    count: z.number().int()
})
export type CountByString = z.infer<typeof countByStringSchema>

export const statsResponseSchema = z.object({
    totalEventsProcessed: z.number(),
    totalEventsProcessedChange: z.string(),
    actionsTaken: z.number(),
    actionsTakenChange: z.string(),
    numberOfAgents: z.number(),
    numberOfAgentsChange: z.string(),
    dailyEvents: z.array(dailyEventCountSchema),
    recentActions: z.array(recentActionSchema),
    recentRuns: z.array(runHistoryRecordWithAgentSchema),
    timezone: z.string(),
    agentActivity: z.array(agentActivityItemSchema),
    statusBreakdown: z.array(countByStringSchema),
    triggerIntegrations: z.array(countByStringSchema),
    actionIntegrations: z.array(countByStringSchema),
    actionTypes: z.array(countByStringSchema)
})
export type StatsResponse = z.infer<typeof statsResponseSchema> & {
    recentRuns: RunHistoryRecordWithAgent[]
}

export const sdkAgentRunOptionsPayloadSchema = z.object({
    maxTurns: z.number().int().optional(),
    requireApproval: z.boolean().optional()
})
export type SdkAgentRunOptionsPayload = z.infer<typeof sdkAgentRunOptionsPayloadSchema>

export const sdkAgentRunRequestBodySchema = z.object({
    prompt: z.string().optional(),
    message: z.string(),
    skills: z.array(skillConfigDataSchema).optional(),
    options: sdkAgentRunOptionsPayloadSchema.optional(),
    toolApprovals: z.array(z.string()).optional(),
    outputSchema: z.record(z.string(), z.unknown()).optional()
})
export type SdkAgentRunRequestBody = z.infer<typeof sdkAgentRunRequestBodySchema>

export const sdkAgentRunResponseContractSchema = z.object({
    responseMode: z.literal("streaming"),
    supportsInterruptions: z.boolean()
})

export const sdkAgentRunNormalizedRequestOptionsSchema = z.object({
    maxTurns: z.number().int(),
    requireApproval: z.boolean()
})

export const sdkAgentRunNormalizedRequestSchema = z.object({
    prompt: z.string(),
    event: TriggerSchema,
    skills: z.array(skillConfigDataSchema),
    toolApprovals: z.array(z.string()),
    options: sdkAgentRunNormalizedRequestOptionsSchema
})

export const sdkAgentRunResponseBodySchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
    details: z.array(z.string()).optional(),
    contract: sdkAgentRunResponseContractSchema.optional(),
    normalizedRequest: sdkAgentRunNormalizedRequestSchema.optional()
})
export type SdkAgentRunResponseBody = z.infer<typeof sdkAgentRunResponseBodySchema>

export const toolApprovalRequestedPayloadSchema = z.object({
    stepId: z.string(),
    toolName: z.string(),
    arguments: z.string()
})

export const runStartedSchema = z.object({ type: z.literal("run_started"), runId: z.string() })

export const textSchema = z.object({ type: z.literal("text"), text: z.string() })

export const finalOutputSchema = z.object({ type: z.literal("final_output"), finalOutput: z.string() })

export const toolCallParamsSchema = z.object({ type: z.literal("tool_call_params"), toolCallParams: z.string() })

export const toolCallStartedSchema = z.object({ type: z.literal("tool_call_started"), toolCallStarted: z.string() })

export const toolCallCompletedSchema = z.object({ type: z.literal("tool_call_completed"), toolCallCompleted: z.string() })

export const toolApprovalRequestedSchema = z.object({
    type: z.literal("tool_approval_requested"),
    toolApprovalRequested: toolApprovalRequestedPayloadSchema
})

export const actionSchema = z.object({ type: z.literal("action"), action: runHistoryActionBaseSchema })

export const errorSchema = z.object({ type: z.literal("error"), message: z.string() })

export const doneSchema = z.object({ type: z.literal("done") })

export const sdkDeployStageEnum = z.enum(["UPLOADING_SOURCE", "BUILDING_DEPENDENCY_IMAGE", "BUILDING_SOURCE_IMAGE", "CONFIGURING_AUTOMATIONS"])
export type SdkDeployStage = z.infer<typeof sdkDeployStageEnum>

export const deployStageSchema = z.object({ type: z.literal("deploy_stage"), stage: sdkDeployStageEnum })

export const sdkAgentStreamEventSchema = z.discriminatedUnion("type", [
    runStartedSchema,
    textSchema,
    finalOutputSchema,
    toolCallParamsSchema,
    toolCallStartedSchema,
    toolCallCompletedSchema,
    toolApprovalRequestedSchema,
    actionSchema,
    errorSchema,
    doneSchema,
    deployStageSchema
])

export type SdkAgentStreamEvent = z.infer<typeof sdkAgentStreamEventSchema> & {
    action?: RunHistoryAction
}

export const sdkApprovalDecisionRequestBodySchema = z.object({
    runId: z.string(),
    stepId: z.string(),
    approved: z.boolean()
})
export type SdkApprovalDecisionRequestBody = z.infer<typeof sdkApprovalDecisionRequestBodySchema>

export const sdkCreateProjectRequestBodySchema = z.object({
    name: z.string().min(1)
})
export type SdkCreateProjectRequestBody = z.infer<typeof sdkCreateProjectRequestBodySchema>

export const sdkCreateProjectResponseBodySchema = z.object({
    projectId: z.string(),
    name: z.string()
})
export type SdkCreateProjectResponseBody = z.infer<typeof sdkCreateProjectResponseBodySchema>

export const projectDetailResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.string(),
    remoteServerUrl: z.string().nullable(),
    isSelfHosted: z.boolean(),
    hasSigningSecret: z.boolean(),
    hasProjectApiKey: z.boolean(),
    jobs: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            isActive: z.boolean()
        })
    )
})
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>

/**
 * Rotation responses for self-hosted project credentials. Both endpoints
 * regenerate the underlying secret immediately (replacing the old value) and
 * return the freshly generated material exactly once.
 */
export const projectRotateSigningSecretResponseSchema = z.object({
    signingSecret: z.string()
})
export type ProjectRotateSigningSecretResponse = z.infer<typeof projectRotateSigningSecretResponseSchema>

export const projectRotateApiKeyResponseSchema = z.object({
    projectApiKey: z.string()
})
export type ProjectRotateApiKeyResponse = z.infer<typeof projectRotateApiKeyResponseSchema>

export const terseProjectConfigSchema = z.object({
    projectId: z.string().min(1),
    name: z.string().min(1),
    selfHosted: z.boolean().optional(),
    remoteServerUrl: z.string().optional()
})
export type TerseProjectConfig = z.infer<typeof terseProjectConfigSchema>

export const sdkDeployJobSchema = z.object({
    jobName: z.string(),
    triggers: z.array(triggerConfigDataSchema)
})
export type SdkDeployJob = z.infer<typeof sdkDeployJobSchema>

export const sdkDeployRequestBodySchema = z
    .object({
        projectId: z.string(),
        cliVersion: z.string(),
        jobs: z.array(sdkDeployJobSchema),
        remoteServerUrl: z.string().optional(),
        sourceZipBase64: z.string().optional()
    })
    .refine(data => !(data.remoteServerUrl && data.sourceZipBase64), {
        message: "remoteServerUrl and sourceZipBase64 cannot be provided together",
        path: ["remoteServerUrl"]
    })
    .refine(data => data.remoteServerUrl != null || data.sourceZipBase64 != null, {
        message: "Either remoteServerUrl or sourceZipBase64 is required",
        path: ["sourceZipBase64"]
    })
export type SdkDeployRequestBody = z.infer<typeof sdkDeployRequestBodySchema>

export const sdkDeployResultSchema = z.object({
    jobName: z.string(),
    automationId: z.string(),
    isUpdate: z.boolean(),
    triggers: z
        .array(
            z.object({
                id: z.string(),
                metadata: triggerMetadataSchema.optional()
            })
        )
        .optional()
})

export const sdkDeployRemovedSchema = z.object({
    id: z.string(),
    name: z.string()
})

export const sdkDeployResponseBodySchema = z.object({
    success: z.boolean(),
    signingSecret: z.string().optional(),
    projectApiKey: z.string().optional(),
    results: z.array(sdkDeployResultSchema),
    removed: z.array(sdkDeployRemovedSchema),
    error: z.string().optional(),
    details: z.string().optional()
})
export type SdkDeployResponseBody = z.infer<typeof sdkDeployResponseBodySchema>

export const sdkJobServerCheckStepSchema = z.enum(["http", "json", "response_schema", "challenge_echo", "challenge_signature"])
export type SdkJobServerCheckStep = z.infer<typeof sdkJobServerCheckStepSchema>

export const sdkJobServerCheckResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    triggerUrl: z.string().optional(),
    step: sdkJobServerCheckStepSchema.optional(),
    httpStatus: z.number().optional()
})
export type SdkJobServerCheckResponse = z.infer<typeof sdkJobServerCheckResponseSchema>

export type AttioUpsertError = z.infer<typeof attioUpsertErrorSchema>

// ─── Request / param schemas ─────────────────────────────────────────

export const agentIdParamsSchema = z.object({
    agentId: z.string()
})

export const agentAndImprovementParamsSchema = z.object({
    agentId: z.string(),
    id: z.string()
})

export const manualTriggerParamsSchema = z.object({
    inputId: z.string()
})

export const triggerWithEventParamsSchema = z.object({
    automationId: z.string()
})

export const logoUploadUrlQuerySchema = z.object({
    contentType: z.string()
})

export const logoParamsSchema = z.object({
    organizationId: z.string()
})

export const webhookWorkOSTriggerParamsSchema = z.object({
    integrationId: z.string()
})

export const organizationCreateRequestSchema = z.object({
    name: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional()
})
export type OrganizationCreateRequest = z.infer<typeof organizationCreateRequestSchema>

export const organizationSwitchRequestSchema = z.object({
    organizationId: z.string()
})
export type OrganizationSwitchRequest = z.infer<typeof organizationSwitchRequestSchema>

export const organizationUpdateRequestSchema = z.object({
    name: z.string()
})
export type OrganizationUpdateRequest = z.infer<typeof organizationUpdateRequestSchema>

export const apiTokenCreateRequestSchema = z.object({
    name: z.string().max(100)
})
export type ApiTokenCreateRequest = z.infer<typeof apiTokenCreateRequestSchema>

export const apiTokenUpdateRequestSchema = z.object({
    name: z.string().max(100)
})
export type ApiTokenUpdateRequest = z.infer<typeof apiTokenUpdateRequestSchema>

export const deviceTokenExchangeRequestSchema = z.object({
    accessToken: z.string()
})
export type DeviceTokenExchangeRequest = z.infer<typeof deviceTokenExchangeRequestSchema>

export const sdkToolExecuteRequestSchema = z.object({
    toolName: z.string(),
    params: z.record(z.string(), z.unknown()).optional()
})
export type SdkToolExecuteRequest = z.infer<typeof sdkToolExecuteRequestSchema>

export const sdkRunTriggerEventResponseSchema = z.object({
    event: serializedEventSchema,
    agentName: z.string()
})
export type SdkRunTriggerEventResponse = z.infer<typeof sdkRunTriggerEventResponseSchema>

export const manualTriggerRequestSchema = z.object({
    context: z.string().optional()
})
export type ManualTriggerRequest = z.infer<typeof manualTriggerRequestSchema>

export const toggleImprovementsEnabledRequestSchema = z.object({
    enabled: z.boolean()
})
export type ToggleImprovementsEnabledRequest = z.infer<typeof toggleImprovementsEnabledRequestSchema>

export const workosWebhookSecretUpdateRequestSchema = z.object({
    webhookSecret: z.string(),
    state: z.string().optional()
})
export type WorkosWebhookSecretUpdateRequest = z.infer<typeof workosWebhookSecretUpdateRequestSchema>

export const sdkSampleEventsRequestSchema = z.object({
    triggers: z
        .array(
            z.object({
                triggerId: z.string().optional(),
                integrationId: z.string(),
                integrationType: integrationTypeEnum,
                config: configDataSchema
            })
        )
        .min(1)
})
export type SdkSampleEventsRequest = z.infer<typeof sdkSampleEventsRequestSchema>

export const hydratorTypeEnum = z.enum(["run_history_raw_event", "slack_message_event", "github_event", "linear_event", "gmail_event", "workos_event", "webmonitor_event"])
export type HydratorType = z.infer<typeof hydratorTypeEnum>

export const identifiableSchema = z.object({
    entityType: hydratorTypeEnum,
    entityId: z.string()
})
export type Identifiable = z.infer<typeof identifiableSchema>

export const sdkSampleEventRefSchema = z.object({
    entity: identifiableSchema,
    serializedEvent: serializedEventSchema
})
export type SdkSampleEventRef = z.infer<typeof sdkSampleEventRefSchema>

export const sdkSampleEventsResponseSchema = z.object({
    events: z.array(sdkSampleEventRefSchema)
})
export type SdkSampleEventsResponse = z.infer<typeof sdkSampleEventsResponseSchema>

export const sdkHydrateSampleEventRequestSchema = z.object({
    entityType: hydratorTypeEnum,
    entityId: z.string()
})
export type SdkHydrateSampleEventRequest = z.infer<typeof sdkHydrateSampleEventRequestSchema>

export const sdkHydrateSampleEventResponseSchema = z.object({
    event: serializedEventSchema
})
export type SdkHydrateSampleEventResponse = z.infer<typeof sdkHydrateSampleEventResponseSchema>

export const triggerWithEventRequestSchema = z.union([
    z.object({
        event: TriggerSchema,
        runId: z.undefined().optional()
    }),
    z.object({
        event: z.undefined().optional(),
        runId: z.string()
    })
])
export type TriggerWithEventRequest = z.infer<typeof triggerWithEventRequestSchema>

export const TERSE_SIGNATURE_HEADER = "x-terse-signature"
export const TERSE_TIMESTAMP_HEADER = "x-terse-timestamp"
export const TERSE_SIGNATURE_VERSION = "v0"

/** Challenge request sent by the Terse backend to the customer's SDK server. */
export const webhookJobChallengeRequestSchema = z.object({
    type: z.literal("challenge"),
    challenge: z.string().min(1)
})
export type WebhookJobChallengeRequest = z.infer<typeof webhookJobChallengeRequestSchema>

/** Challenge response from the customer's SDK server -- echoes the token and signs it with the shared signing secret. */
export const webhookJobChallengeResponseSchema = z.object({
    challenge: z.string().min(1),
    signature: z.string().min(1)
})
export type WebhookJobChallengeResponse = z.infer<typeof webhookJobChallengeResponseSchema>

/** Second-phase POST: full trigger payload after the backend has verified the challenge handshake. */
export const webhookJobTriggerRequestSchema = z.object({
    jobName: z.string(),
    runId: z.string(),
    event: serializedEventSchema
})
export type WebhookJobTriggerRequest = z.infer<typeof webhookJobTriggerRequestSchema>

export const webhookJobTriggerResponseSchema = z.object({
    status: z.string().optional(),
    filtered: z.boolean().optional()
})
export type WebhookJobTriggerResponse = z.infer<typeof webhookJobTriggerResponseSchema>
const fileSchema = z.object({
    id: z.string(),
    name: z.string(),
    get children() {
        return z.array(fileSchema).optional()
    }
})
export type File = z.infer<typeof fileSchema>

export const agentFilesResponseSchema = z.object({
    id: z.string(),
    files: z.array(fileSchema)
})
export type AgentFilesResponse = z.infer<typeof agentFilesResponseSchema>

/** Proxied SDK zip member: raw bytes as base64 plus path metadata (no separate GCS objects). */
export const agentFileContentResponseSchema = z.object({
    path: z.string(),
    fileName: z.string(),
    contentBase64: z.string(),
    mimeType: z.string().optional()
})
export type AgentFileContentResponse = z.infer<typeof agentFileContentResponseSchema>

export const projectDeployStatusSchema = z.enum(["IN_PROGRESS", "SUCCEEDED", "FAILED", "ROLLED_BACK"])
export type ProjectDeployStatus = z.infer<typeof projectDeployStatusSchema>

export const projectDeployUserSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable()
})
export type ProjectDeployUser = z.infer<typeof projectDeployUserSchema>

export const projectDeployJobsDeltaSchema = z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative()
})
export type ProjectDeployJobsDelta = z.infer<typeof projectDeployJobsDeltaSchema>

export const projectDeploySchema = z.object({
    id: z.string(),
    status: projectDeployStatusSchema,
    createdAt: z.string(),
    isActive: z.boolean(),
    deployedBy: projectDeployUserSchema.nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    failureReason: z.string().nullable(),
    jobsDelta: projectDeployJobsDeltaSchema.nullable()
})
export type ProjectDeploy = z.infer<typeof projectDeploySchema>

export const projectDeploysResponseSchema = z.object({
    projectId: z.string(),
    deploys: z.array(projectDeploySchema)
})
export type ProjectDeploysResponse = z.infer<typeof projectDeploysResponseSchema>

export const projectSourceFilesResponseSchema = z.object({
    projectId: z.string(),
    deployId: z.string().nullable(),
    deployedAt: z.string().nullable(),
    files: z.array(fileSchema)
})
export type ProjectSourceFilesResponse = z.infer<typeof projectSourceFilesResponseSchema>

export const sdkListenQuerySchema = z.object({
    jobName: z.string().min(1),
    projectId: z.string().min(1)
})
export type SdkListenQuery = z.infer<typeof sdkListenQuerySchema>

export const sdkListenStartedSchema = z.object({
    type: z.literal("listen_started"),
    listenerId: z.string(),
    organizationId: z.string(),
    projectId: z.string(),
    jobName: z.string()
})

export const sdkListenForwardedEventSchema = z.object({
    type: z.literal("forwarded_event"),
    agentId: z.string(),
    agentName: z.string(),
    projectId: z.string().nullable(),
    event: serializedEventSchema
})

export const sdkListenStreamEventSchema = z.discriminatedUnion("type", [sdkListenStartedSchema, sdkListenForwardedEventSchema])
export type SdkListenStreamEvent = z.infer<typeof sdkListenStreamEventSchema>
export type SdkListenStartedEvent = z.infer<typeof sdkListenStartedSchema>
export type SdkListenForwardedEvent = z.infer<typeof sdkListenForwardedEventSchema>
