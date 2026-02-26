import { CONFIG_DETAILS, ConfigType } from "../shared/Configs"
import { IntegrationType } from "../shared/Integrations"
import { SdkAgentRunRequestBody, SdkAgentRunResponseBody } from "../shared/types"

type NormalizedSdkAgentRunRequest = NonNullable<SdkAgentRunResponseBody["normalizedRequest"]>

type ValidationResult = { ok: true; normalized: NormalizedSdkAgentRunRequest } | { ok: false; errors: string[] }

function isIntegrationType(value: string): value is IntegrationType {
    return Object.values(IntegrationType).includes(value as IntegrationType)
}

function isConfigType(value: string): value is ConfigType {
    return Object.values(ConfigType).includes(value as ConfigType)
}

export function validateAndNormalizeSdkAgentRunBody(body: SdkAgentRunRequestBody): ValidationResult {
    const validationErrors: string[] = []

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    if (!prompt) {
        validationErrors.push("`prompt` is required and must be a non-empty string")
    }

    const event = body.event
    if (event !== undefined && (!event || typeof event !== "object" || Array.isArray(event))) {
        validationErrors.push("`event` must be an object when provided")
    }

    const rawEventIntegrationType = typeof event?.integrationType === "string" ? event.integrationType.trim() : ""
    const formattedContent = typeof event?.formattedContent === "string" ? event.formattedContent.trim() : ""
    const debugLog = typeof event?.debugLog === "string" ? event.debugLog.trim() : ""

    // Event is optional. If provided, require all fields and validate integration type.
    // If omitted, we synthesize a TERSE manual-trigger event.
    if (event !== undefined) {
        if (!rawEventIntegrationType) {
            validationErrors.push("`event.integrationType` is required and must be a non-empty string")
        } else if (!isIntegrationType(rawEventIntegrationType)) {
            validationErrors.push("`event.integrationType` must be a valid IntegrationType")
        }

        if (!formattedContent) {
            validationErrors.push("`event.formattedContent` is required and must be a non-empty string")
        }

        if (!debugLog) {
            validationErrors.push("`event.debugLog` is required and must be a non-empty string")
        }
    }

    const normalizedSkills: NonNullable<NormalizedSdkAgentRunRequest["skills"]> = []
    const skills = Array.isArray(body.skills) ? body.skills : null
    if (!skills || skills.length === 0) {
        validationErrors.push("`skills` is required and must be a non-empty array")
    } else {
        for (let i = 0; i < skills.length; i++) {
            const skill = skills[i]
            if (!skill || typeof skill !== "object" || Array.isArray(skill)) {
                validationErrors.push(`\`skills[${i}]\` must be an object`)
                continue
            }
            if (typeof skill.configType !== "string" || !isConfigType(skill.configType.trim())) {
                validationErrors.push(`\`skills[${i}].configType\` is required and must be a valid ConfigType`)
            }
            if (!skill.config || typeof skill.config !== "object" || Array.isArray(skill.config)) {
                validationErrors.push(`\`skills[${i}].config\` is required and must be an object`)
            }

            const trimmedConfigType = typeof skill.configType === "string" ? skill.configType.trim() : ""
            if (trimmedConfigType && isConfigType(trimmedConfigType)) {
                const integrationType = CONFIG_DETAILS[trimmedConfigType].integrationType
                if (!isIntegrationType(integrationType)) {
                    validationErrors.push(`\`skills[${i}].configType\` maps to an unsupported integration type`)
                    continue
                }
                normalizedSkills.push({
                    configType: trimmedConfigType,
                    config: {
                        ...(skill.config as Record<string, unknown>),
                        integrationType,
                        configType: trimmedConfigType
                    }
                })
            }
        }
    }

    const options = body.options
    if (options !== undefined) {
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            validationErrors.push("`options` must be an object when provided")
        } else {
            if (options.maxTurns !== undefined && (!Number.isInteger(options.maxTurns) || options.maxTurns < 1)) {
                validationErrors.push("`options.maxTurns` must be an integer >= 1 when provided")
            }
            if (options.requireApproval !== undefined && typeof options.requireApproval !== "boolean") {
                validationErrors.push("`options.requireApproval` must be a boolean when provided")
            }
        }
    }

    if (validationErrors.length > 0) {
        return { ok: false, errors: validationErrors }
    }

    const normalized: NormalizedSdkAgentRunRequest = {
        prompt,
        event: {
            integrationType: event === undefined ? IntegrationType.TERSE : (rawEventIntegrationType as IntegrationType),
            formattedContent: event === undefined ? "Manual trigger from terse run" : formattedContent,
            debugLog: event === undefined ? "[MockInputEvent] Manual trigger via SDK" : debugLog
        },
        skills: normalizedSkills,
        options: {
            maxTurns: options?.maxTurns ?? 50,
            requireApproval: options?.requireApproval ?? false
        }
    }

    return { ok: true, normalized }
}
