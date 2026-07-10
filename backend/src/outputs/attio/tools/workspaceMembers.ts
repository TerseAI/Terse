import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"
import type { AttioGetWorkspaceMemberRequest, AttioListWorkspaceMembersRequest, AttioWorkspaceMember, AttioWorkspaceMembersRequest, ToolOutputByName } from "terse-types"

import logger from "../../../common/logger"
import { AttioIntegrationManager } from "../../../integrations/attio/integration"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioApiRequest } from "./attioApi"

export const attioWorkspaceMembersTool = defineSessionTool({
    name: "attio_workspace_members",
    description: `Look up Attio workspace members (the people who use the CRM, not CRM records). Actions: 'list' returns every member with name, email address and access level; 'get' fetches one member by ID. Use this to resolve a record's owner (an actor reference holding a workspace member ID) to a person, e.g. to find the email address for a Slack DM, or to find the member ID/email to write into an owner attribute.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_workspace_members tool", { integrationId, action: request.action })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const orgIntegrations = await manager.getInstancesForOrganization(runContext.context.user.organizationId)
        if (!orgIntegrations.some(i => i.id === integrationId)) {
            throw new Error("Attio integration not found or not authorized for this organization.")
        }

        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        try {
            return await executeWorkspaceMembersRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_workspace_members", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeWorkspaceMembersRequest(request: AttioWorkspaceMembersRequest, accessToken: string): Promise<AttioWorkspaceMembersOutput> {
    switch (request.action) {
        case "list":
            return listWorkspaceMembers(request, accessToken)
        case "get":
            return getWorkspaceMember(request, accessToken)
        default:
            throw request satisfies never
    }
}

async function listWorkspaceMembers(request: AttioListWorkspaceMembersRequest, accessToken: string): Promise<AttioWorkspaceMembersOutput> {
    const data = await attioApiRequest<{ data?: AttioWorkspaceMember[] }>(accessToken, "/workspace-members")
    const members = data.data ?? []

    return {
        success: true,
        action: request.action,
        members,
        count: members.length,
        actions: [
            {
                action: "Listed workspace members",
                integration: IntegrationType.ATTIO,
                target: "Attio workspace",
                details: `Found ${members.length} workspace member(s)`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

async function getWorkspaceMember(request: AttioGetWorkspaceMemberRequest, accessToken: string): Promise<AttioWorkspaceMembersOutput> {
    const data = await attioApiRequest<{ data?: AttioWorkspaceMember }>(accessToken, `/workspace-members/${encodeURIComponent(request.workspaceMemberId)}`)
    if (!data.data) {
        throw new Error(`Attio workspace member "${request.workspaceMemberId}" not found.`)
    }

    return {
        success: true,
        action: request.action,
        member: data.data,
        actions: [
            {
                action: "Fetched workspace member",
                integration: IntegrationType.ATTIO,
                target: request.workspaceMemberId,
                details: `Fetched workspace member ${data.data.email_address || request.workspaceMemberId}`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

type AttioWorkspaceMembersOutput = ToolOutputByName["attio_workspace_members"]
