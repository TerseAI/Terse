import { Tool, tool } from "@openai/agents-core"
import { CONFIG_DETAILS, ConfigData, ConfigType } from "terse-types/Configs"
import type { TerseTool, TerseToolSource } from "terse-types/ToolsTypes"

import type { ToolboxEntry } from "../outputs/abstract/Output"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { convertConfigTypeToOutputConfigType } from "../common/typeConverters"

type CollectedEntry = {
    entry: ToolboxEntry<ConfigData>
    source: TerseToolSource
    configType: ConfigType
}

/**
 * Returns the write-only tools (those that require approval) for the given
 * skills (output config types). Dedupes by
 * tool name; first occurrence wins. Only tools with isReadOnly === false are
 * included.
 */
export function getToolsThatRequireApprovals(skills: ConfigType[]): TerseTool[] {
    skills.forEach(ct => {
        const details = CONFIG_DETAILS[ct]
        if (!details?.isOutput) {
            throw new Error(`Invalid skill config type: ${ct}. Must be an output (isOutput: true).`)
        }
    })

    const map = new Map<string, CollectedEntry>()

    skills.forEach(configType => {
        const output = OutputFactory.createOutput(convertConfigTypeToOutputConfigType(configType))
        if (!output) {
            throw new Error(`Output for config type ${configType} is not supported.`)
        }
        output.toolbox.forEach(entry => {
            const toolEntry = tool(entry.tool) as Tool
            const name = toolEntry.name
            if (!map.has(name)) {
                map.set(name, { entry, source: "skill" as TerseToolSource, configType })
            }
        })
    })

    return Array.from(map.values())
        .filter(({ entry }) => !entry.isReadOnly || entry.supportsApproval)
        .map(({ entry, source, configType }) => {
            const t = entry.tool as { name: string; description?: string }
            return {
                name: t.name,
                displayName: entry.displayName,
                description: typeof t.description === "string" ? t.description : "",
                isReadOnly: entry.isReadOnly,
                integration: entry.integration as string,
                source,
                configType
            }
        })
}
