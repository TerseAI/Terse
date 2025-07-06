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
    const userSlackRelation = await db().user_slack_integrations.findFirst({
        where: {
            user_id: session.user.id
        }
    });

    if (!userSlackRelation) {
        throw new Error("User slack relation not found");
    }

    const dmChannelId = userSlackRelation.dm_channel_id;

    const slackIntegration = await db().slack_integrations.findFirst({
        where: {
            app_id: userSlackRelation.slack_team_id
        }
    });

    if (!slackIntegration || !dmChannelId) {
        throw new Error("Slack integration not found or dm channel id not found");
    }

    const client = new WebClient(slackIntegration.access_token, {
        // LogLevel can be imported and used to make debugging simpler
        logLevel: LogLevel.DEBUG
    });

    try {
        const result = await client.chat.postMessage({
            channel: dmChannelId,
            text: message
        });

        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
}