import { OutputConfigType } from "@prisma/client"
import { ApolloOutputConfig, IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { apolloBulkEnrichPeopleTool } from "./tools/bulkEnrichPeople"
import { apolloEnrichOrganizationTool } from "./tools/enrichOrganization"
import { apolloEnrichPersonTool } from "./tools/enrichPerson"
import { apolloListJobPostingsTool } from "./tools/listJobPostings"
import { apolloSearchPeopleTool } from "./tools/searchPeople"

export class ApolloOutput extends Output<ApolloOutputConfig> {
    constructor() {
        super(OutputConfigType.APOLLO, [
            { tool: apolloEnrichPersonTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Enrich person", supportsApproval: true, validateACL: unrestricted },
            { tool: apolloBulkEnrichPeopleTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Bulk enrich people", supportsApproval: true, validateACL: unrestricted },
            { tool: apolloEnrichOrganizationTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Enrich organization", supportsApproval: true, validateACL: unrestricted },
            { tool: apolloSearchPeopleTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Search people", validateACL: unrestricted },
            { tool: apolloListJobPostingsTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "List job postings", validateACL: unrestricted }
        ])
    }

    async validateConfig(_output: ApolloOutputConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(tx: PrismaTransaction, automationOutputId: string, _output: ApolloOutputConfig): Promise<void> {
        await tx.automation_apollo_output_configs.create({ data: { automation_output_id: automationOutputId } })
    }

    protected getSystemInstructionsForConfigs(configs: ApolloOutputConfig[]): string {
        if (configs.length === 0) throw new Error("No Apollo output configs provided")
        return [
            "=== APOLLO SKILL (READ-ONLY) ===",
            "Enrich people (apolloEnrichPerson, apolloBulkEnrichPeople), enrich companies (apolloEnrichOrganization), search for prospects (apolloSearchPeople), and list job postings as hiring signals (apollo_list_job_postings).",
            "Enrichment consumes Apollo export credits per matched record — prefer apolloBulkEnrichPeople for lists and only enrich records you will use.",
            "apolloSearchPeople is credit-free but returns no emails; pass result ids to apolloBulkEnrichPeople to unlock contact data.",
            "apollo_list_job_postings consumes credits per page returned — fetch one large page instead of paging in small steps.",
            "Available configurations:",
            ...configs.map(config => `  • Integration ID: ${config.integrationId}`)
        ].join("\n")
    }
}
