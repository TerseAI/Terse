import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { SlackMessageAuthorFields, isHumanAuthoredSlackMessage, isSlackMessageRedelivery } from "./messageGuards"

const humanDm: SlackMessageAuthorFields = { user: "U0AEC8GJT26" }
const humanFileShare: SlackMessageAuthorFields = { user: "U0AEC8GJT26", subtype: "file_share" }
const humanThreadBroadcast: SlackMessageAuthorFields = { user: "U0AEC8GJT26", subtype: "thread_broadcast" }
const botMessage: SlackMessageAuthorFields = { bot_id: "B0AEC8GJT26", subtype: "bot_message" }
const slackbotMessage: SlackMessageAuthorFields = { user: "USLACKBOT" }
const botUnfurlEdit: SlackMessageAuthorFields = { subtype: "message_changed" }
const humanEdit: SlackMessageAuthorFields = { subtype: "message_changed" }
const deletion: SlackMessageAuthorFields = { subtype: "message_deleted" }

describe("isSlackMessageRedelivery", () => {
    it("flags the bot's own link-unfurl edit (message_changed with author on the nested message)", () => {
        assert.ok(isSlackMessageRedelivery(botUnfurlEdit))
    })

    it("flags human edits and deletions", () => {
        assert.ok(isSlackMessageRedelivery(humanEdit))
        assert.ok(isSlackMessageRedelivery(deletion))
    })

    it("passes fresh messages through, including subtyped human ones", () => {
        assert.ok(!isSlackMessageRedelivery(humanDm))
        assert.ok(!isSlackMessageRedelivery(humanFileShare))
        assert.ok(!isSlackMessageRedelivery(humanThreadBroadcast))
        assert.ok(!isSlackMessageRedelivery(botMessage))
    })
})

describe("isHumanAuthoredSlackMessage", () => {
    it("accepts a plain human DM", () => {
        assert.ok(isHumanAuthoredSlackMessage(humanDm))
    })

    it("keeps human messages with benign subtypes eligible for fallback", () => {
        assert.ok(isHumanAuthoredSlackMessage(humanFileShare))
        assert.ok(isHumanAuthoredSlackMessage(humanThreadBroadcast))
    })

    it("rejects bot and Slackbot messages", () => {
        assert.ok(!isHumanAuthoredSlackMessage(botMessage))
        assert.ok(!isHumanAuthoredSlackMessage(slackbotMessage))
    })

    it("never treats an authorless envelope as human", () => {
        assert.ok(!isHumanAuthoredSlackMessage(botUnfurlEdit))
        assert.ok(!isHumanAuthoredSlackMessage({}))
    })
})
