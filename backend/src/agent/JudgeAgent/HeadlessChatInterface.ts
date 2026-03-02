import { RunStreamEvent } from "@openai/agents"

import { ConfigType } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { MultipleChoiceQuestion } from "../../shared/Survey"
import ChatInterface from "../ChatAgent/ChatInterfaces/ChatInterface"

class HeadlessChatInterface extends ChatInterface {
    name = "Headless"

    constructor(sessionId: string, userId: string, organizationId?: string) {
        super(sessionId, userId, organizationId)
    }

    async promptForIntegration(_integration: IntegrationType): Promise<string> {
        return "Not supported in headless mode"
    }

    async promptForConfig(_config: ConfigType): Promise<string> {
        return "Not supported in headless mode"
    }

    async askSurveyQuestion(_multipleChoiceQuestion: MultipleChoiceQuestion): Promise<string> {
        return "Not supported in headless mode"
    }

    processStreamEvent(_sessionId: string, _event: RunStreamEvent): void {}

    async processMessageEnd(_sessionId: string, _finalOutput: string): Promise<void> {}

    async buildButton(_label: string, _url: string): Promise<void> {}

    async navigate(_path: string): Promise<void> {}
}

export default HeadlessChatInterface
