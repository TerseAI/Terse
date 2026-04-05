import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import * as z from "zod"

type SchemaCategory = "tool-inputs" | "tool-outputs" | "integrations" | "configs" | "sdk"

type ExportModule = Record<string, unknown>

type SchemaAllowlistEntry = {
    category: SchemaCategory
    exportKey: string
    schemaName: string
    resolve: (moduleExports: ExportModule) => unknown
}

type ToolDefinition = {
    inputSchema: unknown
    outputSchema: unknown
}

const TOOL_EXPORT_KEYS = [
    "linearCreateTicketTool",
    "linearUpdateTicketTool",
    "linearAddCommentTool",
    "linearSearchTicketTool",
    "linearReadTicketTool",
    "linearGetStatesTool",
    "linearGetLabelsTool",
    "linearGetProjectsTool",
    "linearGetTeamsTool",
    "linearGetUsersTool",
    "slackSendMessageTool",
    "slackListChannelsTool",
    "slackListUsersTool",
    "slackReadConversationTool",
    "jiraCreateTicketTool",
    "jiraUpdateTicketTool",
    "jiraSearchTicketTool",
    "searchGitHubCodeTool",
    "grepGitHubCodeTool",
    "readGitHubFileTool",
    "listGitHubDirectoryTool",
    "listGitHubPullRequestsTool",
    "listGitHubCommitsTool",
    "summarizeGitHubPullRequestDiffTool",
    "notionCreateOrUpdatePageTool",
    "notionCreateOrUpdateDatabaseRowTool",
    "notionModifyBlocksTool",
    "notionQueryPageTool",
    "notionQueryDatabaseTool",
    "notionGetSchemaTool",
    "notionFetchRelatedEventsTool",
    "notionListUsersTool",
    "gmailSendEmailTool",
    "gmailCreateDraftTool",
    "confluenceQueryPageTool",
    "confluenceAddCommentTool",
    "searchPosthogSessionsTool",
    "searchPosthogLogsTool",
    "getPosthogSessionEventsTool",
    "searchPosthogEventsTool",
    "searchDatadogLogsTool",
    "searchRumEventsTool",
    "listRumEventsTool",
    "aggregateRumEventsTool",
    "webExtractTool",
    "webResearchTool",
    "imageEditTool",
    "attioListObjectsTool",
    "attioQueryRecordsTool",
    "attioUpsertRecordTool",
    "listWorkOSUsersTool",
    "listWorkOSOrganizationsTool",
    "getWorkOSUserTool",
    "listLaunchDarklyFlagsTool",
    "getLaunchDarklyFlagDetailsTool",
    "snowflakeExecuteQueryTool",
    "snowflakeExplainQueryTool",
    "webSearchTool"
] as const

const STANDALONE_SCHEMAS: SchemaAllowlistEntry[] = [
    {
        category: "tool-outputs",
        exportKey: "runHistoryActionBaseSchema",
        schemaName: "OutputItemSchema",
        resolve(moduleExports) {
            const runHistoryAction = getSchema(moduleExports.runHistoryActionBaseSchema, "runHistoryActionBaseSchema")
            const outputItems = (runHistoryAction as { shape?: Record<string, unknown> }).shape?.output_items
            const outputItemsArray = unwrapSchema(outputItems, "runHistoryActionBaseSchema.shape.output_items")
            const outputItem = getArrayElementSchema(outputItemsArray, "runHistoryActionBaseSchema.shape.output_items")
            return outputItem
        }
    },
    {
        category: "tool-outputs",
        exportKey: "runHistoryActionBaseSchema",
        schemaName: "RunHistoryActionSchema",
        resolve(moduleExports) {
            return moduleExports.runHistoryActionBaseSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "toolOutputBaseSchema",
        schemaName: "ToolOutputBaseSchema",
        resolve(moduleExports) {
            return moduleExports.toolOutputBaseSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "toolOutputSuccessSchema",
        schemaName: "ToolOutputSuccessSchema",
        resolve(moduleExports) {
            return moduleExports.toolOutputSuccessSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "toolOutputFailureSchema",
        schemaName: "ToolOutputFailureSchema",
        resolve(moduleExports) {
            return moduleExports.toolOutputFailureSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "linearTeamSchema",
        schemaName: "LinearTeamSchema",
        resolve(moduleExports) {
            return moduleExports.linearTeamSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "slackUserResponseSchema",
        schemaName: "SlackUserSummarySchema",
        resolve(moduleExports) {
            return moduleExports.slackUserResponseSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "slackChannelListItemSchema",
        schemaName: "SlackChannelListItemSchema",
        resolve(moduleExports) {
            return moduleExports.slackChannelListItemSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "slackConversationMessageSchema",
        schemaName: "SlackConversationMessageSchema",
        resolve(moduleExports) {
            return moduleExports.slackConversationMessageSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "notionPageBlockSchema",
        schemaName: "NotionPageBlockSchema",
        resolve(moduleExports) {
            return moduleExports.notionPageBlockSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "attioAttributeSchema",
        schemaName: "AttioAttributeSchema",
        resolve(moduleExports) {
            return moduleExports.attioAttributeSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "attioObjectWithAttributesSchema",
        schemaName: "AttioObjectWithAttributesSchema",
        resolve(moduleExports) {
            return moduleExports.attioObjectWithAttributesSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "attioRecordIdentifierSchema",
        schemaName: "AttioRecordIdentifierSchema",
        resolve(moduleExports) {
            return moduleExports.attioRecordIdentifierSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "attioRecordSchema",
        schemaName: "AttioRecordSchema",
        resolve(moduleExports) {
            return moduleExports.attioRecordSchema
        }
    },
    {
        category: "tool-outputs",
        exportKey: "attioUpsertErrorSchema",
        schemaName: "AttioUpsertErrorSchema",
        resolve(moduleExports) {
            return moduleExports.attioUpsertErrorSchema
        }
    },
    {
        category: "configs",
        exportKey: "ConfigInstanceSchema",
        schemaName: "BaseConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.ConfigInstanceSchema
        }
    },
    {
        category: "configs",
        exportKey: "GmailConfigSchema",
        schemaName: "GmailConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.GmailConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "GmailOutputConfigSchema",
        schemaName: "GmailOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.GmailOutputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "GmailDraftOutputConfigSchema",
        schemaName: "GmailDraftOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.GmailDraftOutputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "FigmaConfigSchema",
        schemaName: "FigmaConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.FigmaConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "SlackConfigSchema",
        schemaName: "SlackConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.SlackConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "SlackOutputConfigSchema",
        schemaName: "SlackOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.SlackOutputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "NotionConfigSchema",
        schemaName: "NotionConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.NotionConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "LinearInputConfigSchema",
        schemaName: "LinearInputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.LinearInputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "LinearOutputConfigSchema",
        schemaName: "LinearOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.LinearOutputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "GitHubConfigSchema",
        schemaName: "GitHubConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.GitHubConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "JiraConfigSchema",
        schemaName: "JiraConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.JiraConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "ConfluenceConfigSchema",
        schemaName: "ConfluenceConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.ConfluenceConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "PosthogConfigSchema",
        schemaName: "PosthogConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.PosthogConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "DatadogConfigSchema",
        schemaName: "DatadogConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.DatadogConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "TimeTriggerConfigSchema",
        schemaName: "TimeTriggerConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.TimeTriggerConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "LaunchDarklyConfigSchema",
        schemaName: "LaunchDarklyConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.LaunchDarklyConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "TerseConfigSchema",
        schemaName: "TerseConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.TerseConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "WorkOSInputConfigSchema",
        schemaName: "WorkOSInputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.WorkOSInputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "WorkOSOutputConfigSchema",
        schemaName: "WorkOSOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.WorkOSOutputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "AttioOutputConfigSchema",
        schemaName: "AttioOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.AttioOutputConfigSchema
        }
    },
    {
        category: "configs",
        exportKey: "SnowflakeOutputConfigSchema",
        schemaName: "SnowflakeOutputConfigInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.SnowflakeOutputConfigSchema
        }
    },
    {
        category: "integrations",
        exportKey: "IntegrationInstanceSchema",
        schemaName: "BaseIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.IntegrationInstanceSchema
        }
    },
    {
        category: "integrations",
        exportKey: "SlackIntegrationSchema",
        schemaName: "SlackIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.SlackIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "GmailIntegrationSchema",
        schemaName: "GmailIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.GmailIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "FigmaIntegrationSchema",
        schemaName: "FigmaIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.FigmaIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "NotionIntegrationSchema",
        schemaName: "NotionIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.NotionIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "AtlassianIntegrationSchema",
        schemaName: "AtlassianIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.AtlassianIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "GithubIntegrationSchema",
        schemaName: "GitHubIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.GithubIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "LinearIntegrationSchema",
        schemaName: "LinearIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.LinearIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "PosthogIntegrationSchema",
        schemaName: "PosthogIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.PosthogIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "LaunchDarklyIntegrationSchema",
        schemaName: "LaunchDarklyIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.LaunchDarklyIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "DatadogIntegrationSchema",
        schemaName: "DatadogIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.DatadogIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "WorkOSIntegrationSchema",
        schemaName: "WorkOSIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.WorkOSIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "AttioIntegrationSchema",
        schemaName: "AttioIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.AttioIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "SnowflakeIntegrationSchema",
        schemaName: "SnowflakeIntegrationInstanceSchema",
        resolve(moduleExports) {
            return moduleExports.SnowflakeIntegrationSchema
        }
    },
    {
        category: "integrations",
        exportKey: "IntegrationWithStatusSchema",
        schemaName: "IntegrationWithStatusSchema",
        resolve(moduleExports) {
            return moduleExports.IntegrationWithStatusSchema
        }
    },
    {
        category: "sdk",
        exportKey: "roleSchema",
        schemaName: "RoleSchema",
        resolve(moduleExports) {
            return moduleExports.roleSchema
        }
    },
    {
        category: "sdk",
        exportKey: "userSchema",
        schemaName: "UserSchema",
        resolve(moduleExports) {
            return moduleExports.userSchema
        }
    },
    {
        category: "sdk",
        exportKey: "userNoOrganizationSchema",
        schemaName: "UserNoOrganizationSchema",
        resolve(moduleExports) {
            return moduleExports.userNoOrganizationSchema
        }
    },
    {
        category: "sdk",
        exportKey: "repositorySchema",
        schemaName: "RepositorySchema",
        resolve(moduleExports) {
            return moduleExports.repositorySchema
        }
    },
    {
        category: "sdk",
        exportKey: "apiTokenSchema",
        schemaName: "ApiTokenSchema",
        resolve(moduleExports) {
            return moduleExports.apiTokenSchema
        }
    },
    {
        category: "sdk",
        exportKey: "apiTokenCreateResponseSchema",
        schemaName: "ApiTokenCreateResponseSchema",
        resolve(moduleExports) {
            return moduleExports.apiTokenCreateResponseSchema
        }
    },
    {
        category: "sdk",
        exportKey: "agentPromptSchema",
        schemaName: "AgentPromptSchema",
        resolve(moduleExports) {
            return moduleExports.agentPromptSchema
        }
    },
    {
        category: "sdk",
        exportKey: "agentTriggerSchema",
        schemaName: "AgentTriggerSchema",
        resolve(moduleExports) {
            return moduleExports.agentTriggerSchema
        }
    },
    {
        category: "sdk",
        exportKey: "agentOutputSchema",
        schemaName: "AgentOutputSchema",
        resolve(moduleExports) {
            return moduleExports.agentOutputSchema
        }
    },
    {
        category: "sdk",
        exportKey: "triggerPayloadSchema",
        schemaName: "TriggerPayloadSchema",
        resolve(moduleExports) {
            return moduleExports.triggerPayloadSchema
        }
    },
    {
        category: "sdk",
        exportKey: "serializedEventSchema",
        schemaName: "SerializedEventSchema",
        resolve(moduleExports) {
            return moduleExports.serializedEventSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunEventPayloadSchema",
        schemaName: "SdkAgentRunEventPayloadSchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunEventPayloadSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunEventPayloadSchema.partial",
        schemaName: "PartialSdkAgentRunEventPayloadSchema",
        resolve(moduleExports) {
            const schema = getSchema(moduleExports.sdkAgentRunEventPayloadSchema, "sdkAgentRunEventPayloadSchema")
            return schema.partial()
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentSkillPayloadSchema",
        schemaName: "SdkAgentSkillPayloadSchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentSkillPayloadSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunOptionsPayloadSchema",
        schemaName: "SdkAgentRunOptionsPayloadSchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunOptionsPayloadSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunResponseContractSchema",
        schemaName: "SdkAgentRunResponseContractSchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunResponseContractSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunNormalizedRequestOptionsSchema",
        schemaName: "SdkAgentRunNormalizedRequestOptionsSchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunNormalizedRequestOptionsSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunNormalizedRequestSchema",
        schemaName: "SdkAgentRunNormalizedRequestSchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunNormalizedRequestSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunRequestBodySchema",
        schemaName: "SdkAgentRunRequestBodySchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunRequestBodySchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkAgentRunResponseBodySchema",
        schemaName: "SdkAgentRunResponseBodySchema",
        resolve(moduleExports) {
            return moduleExports.sdkAgentRunResponseBodySchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkDeployResultSchema",
        schemaName: "SdkDeployResultSchema",
        resolve(moduleExports) {
            return moduleExports.sdkDeployResultSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkDeployRemovedSchema",
        schemaName: "SdkDeployRemovedSchema",
        resolve(moduleExports) {
            return moduleExports.sdkDeployRemovedSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkDeployJobSchema",
        schemaName: "SdkDeployJobSchema",
        resolve(moduleExports) {
            return moduleExports.sdkDeployJobSchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkDeployRequestBodySchema",
        schemaName: "SdkDeployRequestBodySchema",
        resolve(moduleExports) {
            return moduleExports.sdkDeployRequestBodySchema
        }
    },
    {
        category: "sdk",
        exportKey: "sdkDeployResponseBodySchema",
        schemaName: "SdkDeployResponseBodySchema",
        resolve(moduleExports) {
            return moduleExports.sdkDeployResponseBodySchema
        }
    }
]

const ALLOWLIST: SchemaAllowlistEntry[] = [...STANDALONE_SCHEMAS, ...TOOL_EXPORT_KEYS.flatMap(toolExportKey => buildToolEntries(toolExportKey))] as const

function buildToolEntries(toolExportKey: (typeof TOOL_EXPORT_KEYS)[number]): SchemaAllowlistEntry[] {
    const toolBaseName = capitalize(toolExportKey.replace(/Tool$/, ""))

    return [
        {
            category: "tool-inputs",
            exportKey: toolExportKey,
            schemaName: `${toolBaseName}ToolInputSchema`,
            resolve(moduleExports) {
                return getToolDefinition(moduleExports, toolExportKey).inputSchema
            }
        },
        {
            category: "tool-outputs",
            exportKey: toolExportKey,
            schemaName: `${toolBaseName}ToolOutputSchema`,
            resolve(moduleExports) {
                return getToolDefinition(moduleExports, toolExportKey).outputSchema
            }
        }
    ]
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function getToolDefinition(moduleExports: ExportModule, exportKey: string): ToolDefinition {
    const value = moduleExports[exportKey]
    if (!value || typeof value !== "object") {
        throw new Error(`Missing tool definition export "${exportKey}".`)
    }

    const toolDefinition = value as Partial<ToolDefinition>
    if (!toolDefinition.inputSchema || !toolDefinition.outputSchema) {
        throw new Error(`Export "${exportKey}" is missing inputSchema/outputSchema.`)
    }

    return toolDefinition as ToolDefinition
}

function getSchema(value: unknown, label: string): z.ZodTypeAny {
    if (!value || typeof value !== "object" || !("_zod" in value)) {
        throw new Error(`Resolved "${label}" is not a Zod schema.`)
    }

    return value as z.ZodTypeAny
}

function unwrapSchema(value: unknown, label: string): unknown {
    if (!value || typeof value !== "object") {
        throw new Error(`Resolved "${label}" is not a wrapped Zod schema.`)
    }

    const maybeWrapped = value as { unwrap?: () => unknown }
    if (typeof maybeWrapped.unwrap === "function") {
        return maybeWrapped.unwrap()
    }

    return value
}

function getArrayElementSchema(value: unknown, label: string): unknown {
    if (!value || typeof value !== "object") {
        throw new Error(`Resolved "${label}" is not a Zod array schema.`)
    }

    const maybeArray = value as { element?: unknown }
    if (!maybeArray.element) {
        throw new Error(`Resolved "${label}" is missing an array element schema.`)
    }

    return maybeArray.element
}

function rewriteRecursiveRefs(schemaName: string, value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => rewriteRecursiveRefs(schemaName, item))
    }

    if (!value || typeof value !== "object") {
        return value
    }

    const rewrittenEntries = Object.entries(value).map(([key, entryValue]) => {
        if (key === "$ref" && entryValue === "#") {
            return [key, `#/$defs/${schemaName}`]
        }

        return [key, rewriteRecursiveRefs(schemaName, entryValue)]
    })

    return Object.fromEntries(rewrittenEntries)
}

async function main() {
    const moduleExports = (await import(new URL("../dist/index.js", import.meta.url).href)) as ExportModule
    const defs: Record<string, unknown> = {}

    for (const entry of ALLOWLIST) {
        const resolvedSchema = getSchema(entry.resolve(moduleExports), entry.exportKey)
        const jsonSchema = z.toJSONSchema(resolvedSchema, {
            target: "draft-2020-12",
            unrepresentable: "any",
            cycles: "ref",
            override: ({ zodSchema, jsonSchema }) => {
                const definitionType = (zodSchema as { _zod?: { def?: { type?: string } } })._zod?.def?.type
                if (definitionType === "date" && jsonSchema && typeof jsonSchema === "object") {
                    Object.assign(jsonSchema, {
                        type: "string",
                        format: "date-time"
                    })
                }
            }
        })

        if (jsonSchema && typeof jsonSchema === "object" && "$schema" in jsonSchema) {
            delete (jsonSchema as { $schema?: string }).$schema
        }

        defs[entry.schemaName] = rewriteRecursiveRefs(entry.schemaName, jsonSchema)
    }

    const outputPath = fileURLToPath(new URL("../dist/json-schema/terse-types.schema.json", import.meta.url))
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(
        outputPath,
        `${JSON.stringify(
            {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                $defs: defs
            },
            null,
            2
        )}\n`
    )

    const categoryCounts = ALLOWLIST.reduce<Record<SchemaCategory, number>>(
        (counts, entry) => {
            counts[entry.category] += 1
            return counts
        },
        {
            "tool-inputs": 0,
            "tool-outputs": 0,
            integrations: 0,
            configs: 0,
            sdk: 0
        }
    )

    console.log(`Wrote ${ALLOWLIST.length} schemas to ${outputPath}`)
    console.log(
        `tool-inputs=${categoryCounts["tool-inputs"]}, tool-outputs=${categoryCounts["tool-outputs"]}, integrations=${categoryCounts.integrations}, configs=${categoryCounts.configs}, sdk=${categoryCounts.sdk}`
    )
}

void main().catch(error => {
    console.error("[export-json-schema] Failed to export JSON Schema.")
    console.error(error)
    process.exitCode = 1
})
