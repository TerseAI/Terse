import { ToolBox } from "src/agent/agents/Agent";
import { Output } from "./Output";
import { OutputType } from "./Output";

export class NotionOutput extends Output {
    constructor(toolbox: ToolBox) {
        super(OutputType.Notion, toolbox);
    }
}