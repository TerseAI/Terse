import { setTimeout as delay } from "node:timers/promises"
import { expect } from "vitest"
import { z } from "zod"

import { FileJournalStore, Runtime, defineWorkflow, sleep, step } from "../src/index.js"

import { test } from "./fixtures/filesystem.js"
import { defineInputlessWorkflow } from "./fixtures/workflow.js"

test("runs a typed workflow through steps, sleep, and resume", async ({ journalDirectory }) => {
    let prepareMessageExecutions = 0
    let sendMessageExecutions = 0
    const sentMessages: string[] = []

    const WelcomeWorkflow = defineWorkflow({
        name: "welcome-customer",
        input: z
            .object({
                recipient: z.string(),
                name: z.string()
            })
            .strict(),
        run: async input => {
            const message = await step({
                name: "prepare-message",
                input: {
                    name: input.name
                },
                run: async ({ name }) => {
                    prepareMessageExecutions++
                    return `Welcome, ${name}!`
                }
            })

            await sleep("20ms")

            await step({
                name: "send-message",
                input: {
                    recipient: input.recipient,
                    message
                },
                run: async ({ recipient, message }) => {
                    sendMessageExecutions++
                    sentMessages.push(`${recipient}: ${message}`)
                    return { delivered: true }
                }
            })
        }
    })

    const journalStore = new FileJournalStore(journalDirectory)
    const runtime = new Runtime({ journalStore })
    const runId = "run-123"

    const firstOutcome = await runtime.start(WelcomeWorkflow, {
        runId,
        input: {
            recipient: "ada@example.com",
            name: "Ada"
        }
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")
    expect(await runtime.getRun({ runId })).toMatchObject({
        runId,
        workflowName: "welcome-customer"
    })
    expect(await runtime.getSuspension({ runId })).toEqual(firstOutcome.suspension)

    await delay(35)

    const resumedOutcome = await new Runtime({ journalStore }).resumeTimer(WelcomeWorkflow, {
        runId,
        waitId: firstOutcome.suspension.waitId
    })

    expect(resumedOutcome).toEqual({ status: "completed" })
    expect(prepareMessageExecutions).toBe(1)
    expect(sendMessageExecutions).toBe(1)
    expect(sentMessages).toEqual(["ada@example.com: Welcome, Ada!"])
})

test("resumes a workflow without rerunning completed steps", async ({ journalDirectory }) => {
    let createGreetingExecutions = 0
    let sendGreetingExecutions = 0
    const sentGreetings: string[] = []
    const workflow = defineInputlessWorkflow(async () => {
        const greeting = await step({
            name: "create-greeting",
            input: {
                person: "Ada"
            },
            run: async input => {
                createGreetingExecutions++
                return `Hello, ${input.person}`
            }
        })

        await sleep("20ms")

        await step({
            name: "send-greeting",
            input: {
                greeting
            },
            run: async input => {
                sendGreetingExecutions++
                sentGreetings.push(input.greeting)
                return "sent"
            }
        })
    })
    const journalStore = new FileJournalStore(journalDirectory)
    const firstOutcome = await new Runtime({ journalStore }).start(workflow, {
        runId: "run-123",
        input: null
    })

    if (firstOutcome.status !== "suspended") throw new Error("Expected the workflow to be suspended")

    await delay(35)

    const resumedOutcome = await new Runtime({ journalStore }).resumeTimer(workflow, {
        runId: "run-123",
        waitId: firstOutcome.suspension.waitId
    })

    expect(resumedOutcome).toEqual({ status: "completed" })
    expect(createGreetingExecutions).toBe(1)
    expect(sendGreetingExecutions).toBe(1)
    expect(sentGreetings).toEqual(["Hello, Ada"])
    expect(await journalStore.listByType({ runId: "run-123", eventType: "step.started" })).toHaveLength(2)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "step.completed" })).toHaveLength(2)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.requested" })).toHaveLength(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "wait.resolved" })).toHaveLength(1)
    expect(await journalStore.listByType({ runId: "run-123", eventType: "run.completed" })).toHaveLength(1)
})
