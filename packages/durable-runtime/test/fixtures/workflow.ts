import { z } from "zod"

import { defineWorkflow } from "../../src/index.js"
import type { WorkflowDefinition } from "../../src/index.js"

export function defineInputlessWorkflow(run: () => void | Promise<void>): WorkflowDefinition<z.ZodNull> {
    return defineWorkflow({
        input: z.null(),
        run
    })
}
