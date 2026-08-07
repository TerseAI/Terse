import { createJob, generateText, jobStep, slack, sleep, step, waitForInput } from "terse-sdk"
import { z } from "zod"

import { SlackChannel, Triggers, toolbox } from "./terse.generated"

// `createJob` registers a job with Terse. Each job has a name, one or more
// triggers, and an `onTrigger` handler. `terse test` and `terse run` execute
// them locally.
createJob({
    name: "Tell a programming joke example job",

    // This is where you configure what events will fire this job.
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],

    states: [{ key: "runCount", value: z.number().default(0) }],
    durable: true,
    // The handler runs every time a trigger fires. `event` is typed to match
    // the trigger(s) above.
    onTrigger: async (event, state) => {
        const response = await generateText({
            prompt: "Tell me a joke about Lord of the rings. With Gandalf in it",
            skills: [],
            outputSchema: z.object({ joke: z.string() })
        })

        await toolbox.slack.sendMessage({
            channelId: SlackChannel.AllTerseInc.channelId,
            message: response.joke
        })

        const runCount = await state.get("runCount")
        await state.set("runCount", runCount + 1)

        const work = await jobStep({
            input: runCount,
            inputSchema: z.number(),
            outputSchema: z.string(),
            run: async (runCount: number) => {
                console.log("Run count: ", runCount)
                console.log("pretend there is a lot of work happening here.")

                return "work is done " + runCount
            }
        })

        // console.log(work)

        const result = await waitForInput({
            via: slack({ channel: SlackChannel.AllTerseInc.channelId }),
            prompt: "What is the meaning of life?",
            details: {
                test: "This is a test of the waitForInput function"
            },
            options: [
                { id: "approve", label: "Approve" },
                { id: "reject", label: "Reject" },
                { id: "changes", label: "Request changes", freeText: true }
            ]
        })

        if (result.choice === "approve") {
            await toolbox.slack.sendMessage({
                channelId: SlackChannel.AllTerseInc.channelId,
                message: "this job is approved!"
            })
        } else if (result.choice === "changes") {
            const changes = result.text ?? ""
            await toolbox.slack.sendMessage({
                channelId: SlackChannel.AllTerseInc.channelId,
                message: "this job needs changes!" + changes
            })
        } else {
            await toolbox.slack.sendMessage({
                channelId: SlackChannel.AllTerseInc.channelId,
                message: "this job is rejected!"
            })
        }

        console.log("sleeping for 1 minute")
        await sleep("1m")
        console.log("sleep completed")

        console.log(response.joke)
    }
})

// Ready to ship? Run `terse deploy` to push this job to Terse so its triggers
// start firing in the cloud. Re-run it any time you change a job.

createJob({
    name: "Basic Test - Hello World",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("Hello, world!")
    }
})

createJob({
    name: "Basic Test - Failure, sleep() on non durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("trying to sleep in non durable job")
        await sleep(1000)
        console.log("sleep in non durable job completed")
    }
})

createJob({
    name: "Basic Test - Failure, waitForInput() on non durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("trying to waitForInput in non durable job")
        await waitForInput({
            via: slack({ channel: SlackChannel.AllTerseInc.channelId }),
            prompt: "What is the meaning of life?",
            options: [
                { id: "approve", label: "Approve" },
                { id: "reject", label: "Reject" },
                { id: "changes", label: "Request changes", freeText: true }
            ]
        })
    }
})

createJob({
    name: "Basic Test - Failure, jobStep() on non durable job",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    onTrigger: async event => {
        console.log("trying to jobStep in non durable job")
        await jobStep({
            input: "test",
            inputSchema: z.string(),
            outputSchema: z.string(),
            run: async (input: string) => {
                console.log("jobStep in non durable job completed")
                return "work is done " + input
            }
        })
    }
})

async function fetchTodo(id: number) {
    console.log("fetching todo", id)
    const response = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
    let json = await response.json()
    console.log("todo", json)
    return json
}

createJob({
    name: "Basic Test - step macro",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async event => {
        const todo = await step(fetchTodo(1))

        const todo2 = await step(fetchTodo(2))

        const todo3 = await step(fetchTodo(3))
    }
})

createJob({
    name: "Basic Test - Success. sleep in durable job works",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async event => {
        console.log("trying to sleep in durable job")
        await sleep("2m")
        console.log("sleep in durable job completed")
    }
})
