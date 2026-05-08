import { Tool, ToolInputParameters, ToolOptions, tool } from "@openai/agents"
import type { ACLRule, ConfigData } from "terse-types"

import { Session } from "../../express"
import { Output } from "../../outputs/abstract/Output"
import { createToolACLGuardrail } from "../../tools/acl/createToolACLGuardrail"
import { createNeedsApprovalFunction, formatError } from "../../tools/toolUtils"

import { SessionWithTracking } from "./BaseAgentRunner"

export function buildOpenAiToolsFromOutputs<TSession extends SessionWithTracking<Session>>(params: {
    outputs: Output<ConfigData>[]
    aclRules: ACLRule[]
}): Tool<TSession>[] {
    const allConfigs = params.outputs.flatMap(output => output.configs ?? [])
    const toolsMap = new Map<string, Tool<TSession>>()

    for (const output of params.outputs) {
        const configs = output.configs ?? []
        // This only hides write tools when every config for this output is read-only.
        // Mixed read-only/read-write config groups still expose write tools for the writable configs.
        // Write validators must reject calls targeting read-only integrationIds.
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
                        configs: allConfigs,
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

            const toolEntry = tool(toolOptions as ToolOptions<ToolInputParameters, TSession>)
            toolsMap.set(toolEntry.name, toolEntry)
        }
    }

    return Array.from(toolsMap.values())
}
