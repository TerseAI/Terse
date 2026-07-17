export const SLACKBOT_USER_ID = "USLACKBOT"

export function isSlackMessageRedelivery(messageEvent: SlackMessageAuthorFields): boolean {
    return messageEvent.subtype === "message_changed" || messageEvent.subtype === "message_deleted"
}

export function isHumanAuthoredSlackMessage(messageEvent: SlackMessageAuthorFields): boolean {
    return Boolean(messageEvent.user) && !messageEvent.bot_id && messageEvent.subtype !== "bot_message" && messageEvent.user !== SLACKBOT_USER_ID
}

export interface SlackMessageAuthorFields {
    user?: string
    bot_id?: string
    subtype?: string
}
