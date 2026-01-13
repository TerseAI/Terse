import { RunStreamEvent } from "@openai/agents";
import { ConfigType } from "../../shared/Configs";
import { Channel } from "../../shared/types";
import ChatInterface from "./ChatInterface";
import { IntegrationType } from "../../shared/Integrations";
import logger from "../../logger";
import { SayFn } from "@slack/bolt";

class SlackChatInterface implements ChatInterface {
    name: string = 'Slack';

    constructor(private readonly channel: string, private readonly say: SayFn) {}

    async buildPreview(draft: Channel): Promise<string> {
        return '';
    }

    async promptForIntegration(integration: IntegrationType): Promise<string> {
        return '';
    }

    async promptForConfig(config: ConfigType): Promise<string> {
        return '';
    }

    processStreamEvent(chatId: string, event: RunStreamEvent): void {
    }

    processMessageEnd(chatId: string, finalOutput: string): void {
        logger.info('Slack chat interface processMessageEnd');
        this.say({
            text: finalOutput,
            thread_ts: chatId,
        });
    }
}

export default SlackChatInterface;