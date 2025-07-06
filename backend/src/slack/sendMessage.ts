import { LogLevel, WebClient } from "@slack/web-api";
import { Session } from "../server";
import { db } from "src/prismaClient";


// WebClient instantiates a client that can call API methods
// When using Bolt, you can use either `app.client` or the `client` passed to listeners.

async function replyMessage(message: string, session: Session) {
    if (!session.user) {
        throw new Error("User not found");
    }

    /// fetch the slack integration
    const slackIntegration = await db().slack_integrations.findFirst({
        where: {
            user_id: session.user.id
        }
    });

    if (!slackIntegration) {
        throw new Error("Slack integration not found");
    }

    const client = new WebClient(slackIntegration.access_token, {
        // LogLevel can be imported and used to make debugging simpler
        logLevel: LogLevel.DEBUG
    });

    try {
        // Call the chat.postMessage method using the built-in WebClient
        const result = await client.chat.postMessage({
            // The token you used to initialize your app
            token: slackIntegration.access_token,
            text: message,
        });

        // Print result
        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
}