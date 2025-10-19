import { ToolBox } from "src/agent/agents/Agent";
import { Output } from "./Output";
import { OutputType } from "./Output";

export class NotionOutput extends Output {
    private integrationToken: string;
    private databaseId: string;

    constructor(integrationToken: string, databaseId: string) {
        super(OutputType.Notion, new ToolBox());
        this.integrationToken = integrationToken;
        this.databaseId = databaseId;
    }
}