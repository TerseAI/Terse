import { Tool, ToolInputParameters, ToolOptions, tool } from "@openai/agents"
import type { ACLRule, ConfigData } from "terse-types"

import { Session } from "../../express"
import { Output } from "../../outputs/abstract/Output"
import { createToolACLGuardrail } from "../../tools/acl/createToolACLGuardrail"
import { createNeedsApprovalFunction, formatError } from "../../tools/toolUtils"

import { SessionWithTracking } from "./BaseAgentRunner"

export function buildOpenAiToolsFromOutputs(params: { outputs: Output<ConfigData>[]; aclRules: ACLRule[] }): Tool<SessionWithTracking<Session>>[] {
    const toolsMap = new Map<string, Tool<SessionWithTracking<Session>>>()

    for (const output of params.outputs) {
        const configs = output.configs ?? []
        const allowWriteTools = configs.length === 0 || configs.some(config => config.readOnly !== true)

        for (const entry of output.toolbox) {
            if (entry.isReadOnly === false && !allowWriteTools) {
                continue
            }

            const inputGuardrails = [...(entry.tool.inputGuardrails ?? [])]

            if (entry.validateACL) {
                const toolName = entry.tool.name ?? ""
                inputGuardrails.push(
                    createToolACLGuardrail({
                        toolName,
                        aclRules: params.aclRules,
                        validateACL: entry.validateACL
                    })
                )
            }

            const toolOptions = {
                ...entry.tool,
                inputGuardrails,
                needsApproval: createNeedsApprovalFunction(entry.tool.name ?? ""),
                errorFunction: formatError
            }

            const toolEntry = tool(toolOptions as ToolOptions<ToolInputParameters, SessionWithTracking<Session>>)
            toolsMap.set(toolEntry.name, toolEntry)
        }
    }

    return Array.from(toolsMap.values())
}
