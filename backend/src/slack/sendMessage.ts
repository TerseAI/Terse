import { LogLevel, WebClient } from "@slack/web-api";
import chalk from "chalk";

export async function sendMessage(message: string, accessToken: string, dmChannelId: string) {
  console.log(chalk.blue("Sending message to channel: ", dmChannelId));
  const client = new WebClient(accessToken, {
    // LogLevel can be imported and used to make debugging simpler
    logLevel: LogLevel.DEBUG,
  });

  try {
    const cleaned = sanitizeForSlack(message);

    const result = await client.chat.postMessage({
      channel: dmChannelId,
      text: "Fallback text for notifications",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message,
          },
        },
      ],
    });

    if (result.ok) {
      console.log(chalk.green("✅ Message sent successfully!"));
    } else {
      console.error(chalk.red("❌ Failed to send message!"));
      console.error(chalk.red(result.error));
    }
    console.log(chalk.cyan("📨 Channel:"), chalk.white(dmChannelId));
    console.log(chalk.cyan("🕐 Timestamp:"), chalk.white(result.ts));
    console.log(
      chalk.cyan("💬 Message:"),
      chalk.white(message.substring(0, 100) + (message.length > 100 ? "..." : ""))
    );
  } catch (error) {
    console.error(error);
  }
}

function sanitizeForSlack(text: string): string {
  return text
    .replace(/```/g, "``") // Slack doesn't always like triple backticks
    .replace(/\*/g, "*") // Make sure asterisks are balanced
    .replace(/_(?!_)/g, "_") // Underscores for italics should be balanced
    .replace(/<\/?[^>]+(>|$)/g, ""); // Strip HTML
}
