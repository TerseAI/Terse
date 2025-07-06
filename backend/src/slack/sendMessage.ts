import { LogLevel, WebClient } from "@slack/web-api";
import chalk from "chalk";

export async function sendMessage(message: string, accessToken: string, dmChannelId: string) {
    console.log(chalk.blue("Sending message to channel: ", dmChannelId));
    const client = new WebClient(accessToken, {
        // LogLevel can be imported and used to make debugging simpler
        logLevel: LogLevel.DEBUG
    });

    try {
        const result = await client.chat.postMessage({
            channel: dmChannelId,
            text: message
        });

        console.log(chalk.green('✅ Message sent successfully!'));
        console.log(chalk.cyan('📨 Channel:'), chalk.white(dmChannelId));
        console.log(chalk.cyan('🕐 Timestamp:'), chalk.white(result.ts));
        console.log(chalk.cyan('💬 Message:'), chalk.white(message.substring(0, 100) + (message.length > 100 ? '...' : '')));
    }
    catch (error) {
        console.error(error);
    }
}