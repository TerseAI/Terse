import assert from "node:assert/strict"
import test from "node:test"

import { durableObjectSocketTicketRequestSchema, durableObjectSocketTicketResponseSchema } from "../types"

test("durable object socket tickets bind an actor and trusted metadata", () => {
    assert.deepEqual(
        durableObjectSocketTicketRequestSchema.parse({
            triggerId: "trigger-1",
            actorId: "room-1",
            metadata: { userId: "user-1" }
        }),
        {
            triggerId: "trigger-1",
            actorId: "room-1",
            metadata: { userId: "user-1" }
        }
    )
    assert.equal(
        durableObjectSocketTicketResponseSchema.parse({
            url: "wss://actors.example.com/v1/socket/trigger-1/room-1",
            protocols: ["terse-do", "terse-ticket.signed"],
            expiresAt: "2026-09-03T12:00:00.000Z"
        }).protocols[0],
        "terse-do"
    )
})
