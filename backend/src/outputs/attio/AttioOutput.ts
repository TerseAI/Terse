import { OutputConfigType } from "@prisma/client"
import { AttioOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { AttioIntegrationManager } from "../../integrations/attio/integration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { attioCommentsTool } from "./tools/comments"
import { attioFilesTool } from "./tools/files"
import { attioListsTool } from "./tools/lists"
import { attioMeetingsTool } from "./tools/meetings"
import { attioNotesTool } from "./tools/notes"
import { attioRecordsTool, validateAttioRecords } from "./tools/records"
import { attioSchemaTool } from "./tools/schema"
import { attioTasksTool } from "./tools/tasks"
import { attioWorkspaceMembersTool } from "./tools/workspaceMembers"

export class AttioOutput extends Output<AttioOutputConfig> {
    constructor() {
        super(OutputConfigType.ATTIO, [
            { tool: attioRecordsTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Records", validateACL: validateAttioRecords },
            { tool: attioWorkspaceMembersTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Workspace members", validateACL: unrestricted },
            { tool: attioTasksTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Tasks", validateACL: unrestricted },
            { tool: attioNotesTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Notes", validateACL: unrestricted },
            { tool: attioCommentsTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Comments", validateACL: unrestricted },
            { tool: attioListsTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Lists", validateACL: unrestricted },
            { tool: attioMeetingsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Meetings", validateACL: unrestricted },
            { tool: attioFilesTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Files", validateACL: unrestricted },
            { tool: attioSchemaTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Schema", validateACL: unrestricted }
        ])
    }

    async validateConfig(output: AttioOutputConfig, _userId: string): Promise<void> {
        if (!output.objectSlug) {
            throw new Error("Invalid output config for attio_output: missing objectSlug")
        }

        // Validate the object exists in Attio
        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(output.integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        const response = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(output.objectSlug)}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (!response.ok) {
            throw new Error(`Attio object "${output.objectSlug}" not found or not accessible`)
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: AttioOutputConfig): Promise<void> {
        await tx.automation_attio_configs.create({
            data: {
                automation_output_id: channelOutputId,
                object_slug: output.objectSlug || ""
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AttioOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Attio configs provided")
        }

        const sections: string[] = []
        sections.push("=== ATTIO OUTPUT ===")

        const configList: string[] = []
        for (const config of configs) {
            const objectSlug = config.objectSlug
            configList.push(`  - Integration ID: ${config.integrationId} - Object: ${objectSlug}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Attio tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")
        sections.push("Use attio_schema with the 'list_objects' action to discover available object types and their attributes before creating/updating records.")
        sections.push("Use attio_records with the 'query' or 'search' action to find existing records before updating them; 'query' supports limit/offset pagination for full scans.")
        sections.push("Prefer 'upsert' when a unique writable attribute exists (e.g. email_addresses, domains); use 'create' for objects without one (e.g. deals).")
        sections.push(
            'Owner attributes are actor references to workspace members: use attio_workspace_members to find the member, then write either their email address string or { referenced_actor_type: "workspace-member", referenced_actor_id: "<id>" }.'
        )
        sections.push("Tasks, notes, comments, list entries, meetings and files each have their own tool (attio_tasks, attio_notes, attio_comments, attio_lists, attio_meetings, attio_files).")

        return sections.join("\n")
    }
}
