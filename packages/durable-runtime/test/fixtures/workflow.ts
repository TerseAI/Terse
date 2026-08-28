import { z } from "zod"

import { defineWorkflow } from "../../src/index.js"
import type { WorkflowDefinition } from "../../src/index.js"

export function defineInputlessWorkflow(run: () => void | Promise<void>, name = "test-workflow"): WorkflowDefinition<z.ZodNull> {
    return defineWorkflow({
        name,
        input: z.null(),
        run
    })
}
