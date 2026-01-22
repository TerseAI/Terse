import { ConfigType, CONFIG_DETAILS } from '../shared/Configs';
import { IntegrationType } from '../shared/Integrations';
import type { TerseTool, TerseToolSource } from '../shared/ToolsTypes';
import { convertConfigTypeToOutputConfigType, convertConfigTypeToKnowledgeBaseConfigType } from '../utility/typeConverters';
import { OutputFactory } from '../outputs/abstract/OutputFactory';
import { KnowledgeBaseFactory } from '../knowledgeBase/abstract/KnowledgeBaseFactory';
import type { ToolboxEntry } from '../outputs/abstract/Output';
import { OutputConfigType } from '@prisma/client';

type CollectedEntry = {
  entry: ToolboxEntry;
  source: TerseToolSource;
  configType: ConfigType;
};

/**
 * Returns the write-only tools (those that require approval) for the given
 * skills (output config types) and knowledge base config types. Dedupes by
 * tool name; first occurrence wins. Only tools with isReadOnly === false are
 * included.
 */
export function getToolsThatRequireApprovals(
  skills: ConfigType[],
  knowledgeBases: ConfigType[]
): TerseTool[] {
  for (const ct of skills) {
    const details = CONFIG_DETAILS[ct];
    if (!details?.isOutput) {
      throw new Error(`Invalid skill config type: ${ct}. Must be an output (isOutput: true).`);
    }
  }
  for (const ct of knowledgeBases) {
    const details = CONFIG_DETAILS[ct];
    if (!details?.isKnowledgeBase) {
      throw new Error(`Invalid knowledge base config type: ${ct}. Must be a knowledge base (isKnowledgeBase: true).`);
    }
  }

  const map = new Map<string, CollectedEntry>();

  for (const configType of skills) {
    const outputConfigType = convertConfigTypeToOutputConfigType(configType);
    const output = OutputFactory.createOutput(outputConfigType);
    if (!output) {
      throw new Error(`Output type ${outputConfigType} is not supported.`);
    }
    for (const entry of output.toolbox) {
      const name = entry.tool.name;
      if (!map.has(name)) {
        map.set(name, { entry, source: 'skill' as TerseToolSource, configType });
      }
    }
  }

  for (const configType of knowledgeBases) {
    const kbConfigType = convertConfigTypeToKnowledgeBaseConfigType(configType);
    const kb = KnowledgeBaseFactory.createKnowledgeBase(kbConfigType);
    if (!kb) {
      throw new Error(`Knowledge base type ${kbConfigType} is not supported.`);
    }
    for (const entry of kb.toolbox) {
      const name = entry.tool.name;
      if (!map.has(name)) {
        map.set(name, { entry, source: 'knowledgeBase' as TerseToolSource, configType });
      }
    }
  }

  const tools: TerseTool[] = [];
  for (const { entry, source, configType } of map.values()) {
    if (entry.isReadOnly) continue;
    const t = entry.tool as { name: string; description?: string };
    tools.push({
      name: t.name,
      displayName: entry.displayName,
      description: typeof t.description === 'string' ? t.description : '',
      isReadOnly: entry.isReadOnly,
      integration: entry.integration as string,
      source,
      configType,
    });
  }
  return tools;
}
