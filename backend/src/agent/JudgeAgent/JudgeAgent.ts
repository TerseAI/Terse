import { z } from "zod"

export const MAX_IMPROVEMENTS_PER_AGENT = 4

export const JudgeAgentOutput = z.object({
    title: z.string(),
    summary: z.string(),
    improvements: z.array(
        z.object({
            title: z.string(),
            description: z.string(),
            targetArea: z.enum(["prompt", "trigger_config", "output_config", "general", "code"]),
            confidence: z.number().min(0).max(1),
            suggestedPatch: z.string().optional()
        })
    )
})

export type JudgeAgentOutputType = z.infer<typeof JudgeAgentOutput>
