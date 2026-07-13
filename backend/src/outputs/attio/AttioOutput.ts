import { OutputConfigType } from "@prisma/client"
import { AttioOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { AttioIntegrationManager } from "../../integrations/attio/integration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { attioCreateCommentTool, attioDeleteCommentTool, attioReadCommentsTool } from "./tools/comments"
import { attioDeleteFileTool, attioReadFilesTool, attioUploadFileTool } from "./tools/files"
import {
    attioAddListEntryTool,
    attioCreateListTool,
    attioReadListEntriesTool,
    attioReadListsTool,
    attioRemoveListEntryTool,
    attioUpdateListEntryTool,
    attioUpdateListTool,
    attioUpsertListEntryTool
} from "./tools/lists"
import { attioMeetingsTool } from "./tools/meetings"
import { attioCreateNoteTool, attioDeleteNoteTool, attioReadNotesTool } from "./tools/notes"
import { attioCreateRecordTool, attioDeleteRecordTool, attioReadRecordsTool, attioUpdateRecordTool, attioUpsertRecordTool, validateAttioRecords } from "./tools/records"
import { attioModifySchemaTool, attioReadSchemaTool } from "./tools/schema"
import { attioCreateTaskTool, attioDeleteTaskTool, attioReadTasksTool, attioUpdateTaskTool } from "./tools/tasks"
import { attioWorkspaceMembersTool } from "./tools/workspaceMembers"

export class AttioOutput extends Output<AttioOutputConfig> {
    constructor() {
        super(OutputConfigType.ATTIO, [
            { tool: attioReadRecordsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read records", validateACL: validateAttioRecords },
            { tool: attioCreateRecordTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Create record", validateACL: validateAttioRecords },
            { tool: attioUpdateRecordTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Update record", validateACL: validateAttioRecords },
            { tool: attioUpsertRecordTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Upsert records", validateACL: validateAttioRecords },
            { tool: attioDeleteRecordTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Delete record", validateACL: validateAttioRecords },
            { tool: attioWorkspaceMembersTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Workspace members", validateACL: unrestricted },
            { tool: attioReadTasksTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read tasks", validateACL: unrestricted },
            { tool: attioCreateTaskTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Create task", validateACL: unrestricted },
            { tool: attioUpdateTaskTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Update task", validateACL: unrestricted },
            { tool: attioDeleteTaskTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Delete task", validateACL: unrestricted },
            { tool: attioReadNotesTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read notes", validateACL: unrestricted },
            { tool: attioCreateNoteTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Create note", validateACL: unrestricted },
            { tool: attioDeleteNoteTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Delete note", validateACL: unrestricted },
            { tool: attioReadCommentsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read comments", validateACL: unrestricted },
            { tool: attioCreateCommentTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Create comment", validateACL: unrestricted },
            { tool: attioDeleteCommentTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Delete comment", validateACL: unrestricted },
            { tool: attioReadListsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read lists", validateACL: unrestricted },
            { tool: attioCreateListTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Create list", validateACL: unrestricted },
            { tool: attioUpdateListTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Update list", validateACL: unrestricted },
            { tool: attioReadListEntriesTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read list entries", validateACL: unrestricted },
            { tool: attioAddListEntryTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Add list entry", validateACL: unrestricted },
            { tool: attioUpsertListEntryTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Upsert list entry", validateACL: unrestricted },
            { tool: attioUpdateListEntryTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Update list entry", validateACL: unrestricted },
            { tool: attioRemoveListEntryTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Remove list entry", validateACL: unrestricted },
            { tool: attioMeetingsTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Meetings", validateACL: unrestricted },
            { tool: attioReadFilesTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read files", validateACL: unrestricted },
            { tool: attioUploadFileTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Upload file", validateACL: unrestricted },
            { tool: attioDeleteFileTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Delete file", validateACL: unrestricted },
            { tool: attioReadSchemaTool, isReadOnly: true, integration: IntegrationType.ATTIO, displayName: "Read schema", validateACL: unrestricted },
            { tool: attioModifySchemaTool, isReadOnly: false, integration: IntegrationType.ATTIO, displayName: "Modify schema", validateACL: unrestricted }
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
        sections.push("Use attio_read_schema with the 'list_objects' action to discover available object types and their attributes before creating/updating records.")
        sections.push("Use attio_read_records with the 'query' or 'search' action to find existing records before updating them; 'query' supports limit/offset pagination for full scans.")
        sections.push("Prefer attio_upsert_record when a unique writable attribute exists (e.g. email_addresses, domains); use attio_create_record for objects without one (e.g. deals).")
        sections.push(
            'Owner attributes are actor references to workspace members: use attio_workspace_members to find the member, then write either their email address string or { referenced_actor_type: "workspace-member", referenced_actor_id: "<id>" }.'
        )
        sections.push(
            "Tasks, notes, comments, lists, list entries, meetings and files each have their own read tool (attio_read_tasks, attio_read_notes, attio_read_comments, attio_read_lists, attio_read_list_entries, attio_meetings, attio_read_files) plus per-operation write tools (e.g. attio_create_task, attio_add_list_entry, attio_upload_file)."
        )

        return sections.join("\n")
    }
}
