import { ConfigType } from './Configs';

export type TerseToolSource = 'skill' | 'knowledgeBase';

export interface TerseTool {
  name: string;
  displayName: string;
  description: string;
  isReadOnly: boolean;
  integration: string;
  source: TerseToolSource;
  configType: ConfigType;
}

export interface GetToolsThatRequireApprovalsRequest {
  skills: ConfigType[];
  knowledgeBases?: ConfigType[];
}

export interface GetToolsThatRequireApprovalsResponse {
  tools: TerseTool[];
}
