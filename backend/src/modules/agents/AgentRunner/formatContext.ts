import { formatConfigForAgent } from "terse-types"

import logger from "../../../common/logger"
import { convertPrismaConfigToConfigData, convertPrismaOutputConfigToConfigData } from "../../../common/typeConverters"
import { AgentOutput, AgentOutputWithConfigs, AgentPrompt, AgentTrigger, AgentTriggerWithConfigs } from "../../../types/prisma"

type FormattableAgent = {
    id: string
    name: string
    is_active: boolean
    require_approval: boolean
    prompt: AgentPrompt | null
    inputs: AgentTriggerWithConfigs[]
    outputs: AgentOutputWithConfigs[]
}

export function isScaffoldedRunContextUserMessage(text: string): boolean {
    const normalized = text.trim()
    if (!normalized) return false
    return normalized.includes("<EVENT>")
}

export function formatAgentForSystemPrompt(agent: FormattableAgent): string {
    const sections: string[] = []

    // Header with name, ID, and status
    sections.push(`Agent: "${agent.name}"`)
    sections.push(`ID: ${agent.id}`)
    sections.push(`Status: ${agent.is_active ? "Active" : "Inactive"}`)
    sections.push(`Requires Approval: ${agent.require_approval ? "Yes" : "No"}`)

    // Prompt section
    if (agent.prompt?.content) {
        sections.push("")
        sections.push("Prompt:")
        sections.push(indent(agent.prompt.content))
    }

    // Triggers section
    if (agent.inputs && agent.inputs.length > 0) {
        sections.push("")
        sections.push("Triggers:")
        sections.push(indent(formatAgentTriggersForAgent(agent.inputs)))
    }

    // Outputs section
    if (agent.outputs && agent.outputs.length > 0) {
        sections.push("")
        sections.push("Outputs:")
        sections.push(indent(formatAgentOutputsForAgent(agent.outputs)))
    }

    return sections.join("\n")
}

function formatAgentTriggerForAgent(input: AgentTrigger | AgentTriggerWithConfigs): string {
    try {
        const configData = convertPrismaConfigToConfigData(input as AgentTriggerWithConfigs)

        return formatConfigForAgent(configData)
    } catch (error) {
        logger.warn("Failed to convert channel input to ConfigData", { error, configType: input.config_type, inputId: input.id })
        return `Type: ${input.config_type}`
    }
}

function formatAgentOutputForAgent(output: AgentOutput | AgentOutputWithConfigs): string {
    try {
        const configData = convertPrismaOutputConfigToConfigData(output as AgentOutputWithConfigs)
        return formatConfigForAgent(configData)
    } catch (error) {
        logger.warn("Failed to convert channel output to ConfigData", { error, configType: output.config_type, outputId: output.id })
        return `Type: ${output.config_type}`
    }
}

function formatAgentTriggersForAgent(inputs: (AgentTrigger | AgentTriggerWithConfigs)[]): string {
    if (inputs.length === 0) {
        return "No triggers configured"
    }

    if (inputs.length === 1) {
        return formatAgentTriggerForAgent(inputs[0])
    }

    return inputs
        .map((input, index) => {
            const formatted = formatAgentTriggerForAgent(input)
            return `Trigger ${index + 1}:\n${indent(formatted)}`
        })
        .join("\n\n")
}

function formatAgentOutputsForAgent(outputs: (AgentOutput | AgentOutputWithConfigs)[]): string {
    if (outputs.length === 0) {
        return "No outputs configured"
    }

    if (outputs.length === 1) {
        return formatAgentOutputForAgent(outputs[0])
    }

    return outputs
        .map((output, index) => {
            const formatted = formatAgentOutputForAgent(output)
            return `Output ${index + 1}:\n${indent(formatted)}`
        })
        .join("\n\n")
}

function indent(text: string, spaces: number = 2): string {
    const prefix = " ".repeat(spaces)
    return text
        .split("\n")
        .map(line => `${prefix}${line}`)
        .join("\n")
}
