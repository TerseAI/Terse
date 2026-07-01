import { createJob, generateText, jobStep, sleep } from "terse-sdk"
import { z } from "zod"

// Triggers, Skills, and resource constants for your workspace live here.
// Run `terse generate` to refresh after connecting new integrations.
import { SlackChannel, Triggers, toolbox } from "./terse.generated"

// `createJob` registers a job with Terse. Each job has a name, one or more
// triggers, and an `onTrigger` handler. `terse test` and `terse run` execute
// them locally.
createJob({
    name: "Tell a programming joke example job",

    // This is where you configure what events will fire this job.
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],

    states: [{ key: "runCount", value: z.number().default(0) }],
    durable: false,
    // The handler runs every time a trigger fires. `event` is typed to match
    // the trigger(s) above.
    onTrigger: async (event, state) => {
        // `generateText` runs the model and returns its output. `skills`
        // declares which integrations the model can call — keep the list
        // narrow so it only touches what you intend. The optional `outputSchema`
        // (a Zod schema) forces a structured response: `response` is typed
        // `{ joke: string }`.

        // jobStep({
        //     run: async () => {
        //         console.log("OMG WE ARE ABOUT TO SLEEP FOR 1 MINUTE")
        //     }
        // })

        const response = await generateText({
            prompt: "Tell me a joke about Game Of thrones",
            skills: [],
            outputSchema: z.object({ joke: z.string() })
        })

        await toolbox.slack.sendMessage({
            channelId: SlackChannel.AllTerseInc.channelId,
            message: response.joke
        })

        const runCount = await state.get("runCount")
        await state.set("runCount", runCount + 1)

        // const work = await jobStep({
        //     input: runCount,
        //     inputSchema: z.number(),
        //     outputSchema: z.string(),
        //     run: async (runCount: number) => {
        //         console.log("Run count: ", runCount)
        //         console.log("pretend there is a lot of work happening here.")

        //         return "work is done " + runCount
        //     }
        // })

        // console.log(work)

        // await sleep("1m")

        await toolbox.slack.sendMessage({
            channelId: SlackChannel.AllTerseInc.channelId,
            message: "this job is done! we are DURABLE"
        })

        console.log(response.joke)
    }
})

// Ready to ship? Run `terse deploy` to push this job to Terse so its triggers
// start firing in the cloud. Re-run it any time you change a job.
