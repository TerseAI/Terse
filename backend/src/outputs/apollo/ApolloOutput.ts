import { OutputConfigType } from "@prisma/client"
import { ApolloOutputConfig, IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { apolloBulkEnrichPeopleTool } from "./tools/bulkEnrichPeople"
import { apolloEnrichOrganizationTool } from "./tools/enrichOrganization"
import { apolloEnrichPersonTool } from "./tools/enrichPerson"
import { apolloSearchPeopleTool } from "./tools/searchPeople"

export class ApolloOutput extends Output<ApolloOutputConfig> {
    constructor() {
        super(OutputConfigType.APOLLO, [
            { tool: apolloEnrichPersonTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Enrich person", supportsApproval: true, validateACL: unrestricted },
            { tool: apolloBulkEnrichPeopleTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Bulk enrich people", supportsApproval: true, validateACL: unrestricted },
            { tool: apolloEnrichOrganizationTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Enrich organization", supportsApproval: true, validateACL: unrestricted },
            { tool: apolloSearchPeopleTool, isReadOnly: true, integration: IntegrationType.APOLLO, displayName: "Search people", validateACL: unrestricted }
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
            "Enrich people (apolloEnrichPerson, apolloBulkEnrichPeople), enrich companies (apolloEnrichOrganization), and search for prospects (apolloSearchPeople).",
            "Enrichment consumes Apollo export credits per matched record — prefer apolloBulkEnrichPeople for lists and only enrich records you will use.",
            "apolloSearchPeople is credit-free but returns no emails; pass result ids to apolloBulkEnrichPeople to unlock contact data.",
            "Available configurations:",
            ...configs.map(config => `  • Integration ID: ${config.integrationId}`)
        ].join("\n")
    }
}
