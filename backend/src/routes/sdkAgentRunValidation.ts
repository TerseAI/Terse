import { z } from "zod"

import { CONFIG_DETAILS, ConfigType } from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"
import { SdkAgentRunRequestBody, SdkAgentRunResponseBody } from "../shared/types"

type NormalizedSdkAgentRunRequest = NonNullable<SdkAgentRunResponseBody["normalizedRequest"]>

type ValidationResult = { ok: true; normalized: NormalizedSdkAgentRunRequest } | { ok: false; errors: string[] }

const integrationTypeValues = Object.values(IntegrationType) as [IntegrationType, ...IntegrationType[]]
const configTypeValues = Object.values(ConfigType) as [ConfigType, ...ConfigType[]]

const skillSchema = z
    .object({
        configType: z.enum(configTypeValues, { message: "`skills[i].configType` must be a valid ConfigType" }),
        config: z.record(z.unknown())
    })
    .transform(skill => {
        const integrationType = CONFIG_DETAILS[skill.configType].integrationType
        return {
            configType: skill.configType,
            config: { ...skill.config, integrationType, configType: skill.configType }
        }
    })

const sdkAgentRunSchema = z.object({
    prompt: z.string().min(1, "`prompt` is required and must be a non-empty string"),
    event: z
        .object({
            integrationType: z.enum(integrationTypeValues, {
                message: "`event.integrationType` must be a valid IntegrationType"
            }),
            formattedContent: z.string().min(1, "`event.formattedContent` is required and must be a non-empty string"),
            debugLog: z.string().min(1, "`event.debugLog` is required and must be a non-empty string")
        })
        .optional(),
    skills: z.array(skillSchema).optional(),
    options: z
        .object({
            maxTurns: z.number().int().min(1, "`options.maxTurns` must be an integer >= 1 when provided").optional(),
            requireApproval: z.boolean().optional()
        })
        .optional()
})

export function validateAndNormalizeSdkAgentRunBody(body: SdkAgentRunRequestBody): ValidationResult {
    const result = sdkAgentRunSchema.safeParse(body)

    if (!result.success) {
        return { ok: false, errors: result.error.errors.map(e => e.message) }
    }

    const { data } = result

    const normalized: NormalizedSdkAgentRunRequest = {
        prompt: data.prompt,
        event: {
            integrationType: data.event?.integrationType ?? IntegrationType.TERSE,
            formattedContent: data.event?.formattedContent ?? "Manual trigger from terse run",
            debugLog: data.event?.debugLog ?? "[MockInputEvent] Manual trigger via SDK"
        },
        skills: data.skills ?? [],
        options: {
            maxTurns: data.options?.maxTurns ?? 50,
            requireApproval: data.options?.requireApproval ?? true
        }
    }

    return { ok: true, normalized }
}
