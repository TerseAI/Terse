import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioWorkspaceMemberSchema } from "terse-types"
import type { AttioGetWorkspaceMemberRequest, AttioListWorkspaceMembersRequest, AttioWorkspaceMembersRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { attioRequestData, resolveAttioAccessToken } from "./attioApi"

export const attioWorkspaceMembersTool = defineSessionTool({
    name: "attio_workspace_members",
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_workspace_members tool", { integrationId, action: request.action })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

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
    const members = await attioRequestData(accessToken, "/workspace_members", z.array(attioWorkspaceMemberSchema), "workspace members")

    return {
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
    const member = await attioRequestData(accessToken, `/workspace_members/${encodeURIComponent(request.workspaceMemberId)}`, attioWorkspaceMemberSchema, "workspace member")

    return {
        member,
        actions: [
            {
                action: "Fetched workspace member",
                integration: IntegrationType.ATTIO,
                target: request.workspaceMemberId,
                details: `Fetched workspace member ${member.email_address || request.workspaceMemberId}`,
                type: RunHistoryActionType.read
            }
        ]
    }
}

type AttioWorkspaceMembersOutput = ToolOutputByName["attio_workspace_members"]
