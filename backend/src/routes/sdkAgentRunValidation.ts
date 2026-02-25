import { IntegrationType } from "../shared/Integrations"
import { SdkAgentRunRequestBody, SdkAgentRunResponseBody } from "../shared/types"

type NormalizedSdkAgentRunRequest = NonNullable<SdkAgentRunResponseBody["normalizedRequest"]>

type ValidationResult = { ok: true; normalized: NormalizedSdkAgentRunRequest } | { ok: false; errors: string[] }

function isIntegrationType(value: string): value is IntegrationType {
    return Object.values(IntegrationType).includes(value as IntegrationType)
}

export function validateAndNormalizeSdkAgentRunBody(body: SdkAgentRunRequestBody): ValidationResult {
    const validationErrors: string[] = []

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    if (!prompt) {
        validationErrors.push("`prompt` is required and must be a non-empty string")
    }

    const event = body.event
    if (!event || typeof event !== "object" || Array.isArray(event)) {
        validationErrors.push("`event` is required and must be an object")
    }

    const rawEventIntegrationType = typeof event?.integrationType === "string" ? event.integrationType.trim() : ""
    if (!rawEventIntegrationType) {
        validationErrors.push("`event.integrationType` is required and must be a non-empty string")
    } else if (!isIntegrationType(rawEventIntegrationType)) {
        validationErrors.push("`event.integrationType` must be a valid IntegrationType")
    }

    const formattedContent = typeof event?.formattedContent === "string" ? event.formattedContent.trim() : ""
    if (!formattedContent) {
        validationErrors.push("`event.formattedContent` is required and must be a non-empty string")
    }

    const debugLog = typeof event?.debugLog === "string" ? event.debugLog.trim() : ""
    if (!debugLog) {
        validationErrors.push("`event.debugLog` is required and must be a non-empty string")
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
            if (typeof skill.integrationType !== "string" || !skill.integrationType.trim()) {
                validationErrors.push(`\`skills[${i}].integrationType\` is required and must be a non-empty string`)
            } else if (!isIntegrationType(skill.integrationType.trim())) {
                validationErrors.push(`\`skills[${i}].integrationType\` must be a valid IntegrationType`)
            }
            if (skill.id !== undefined && (typeof skill.id !== "string" || !skill.id.trim())) {
                validationErrors.push(`\`skills[${i}].id\` must be a non-empty string when provided`)
            }

            const trimmedIntegrationType = typeof skill.integrationType === "string" ? skill.integrationType.trim() : ""
            if (trimmedIntegrationType && isIntegrationType(trimmedIntegrationType)) {
                normalizedSkills.push({
                    integrationType: trimmedIntegrationType,
                    id: skill.id?.trim()
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
            integrationType: rawEventIntegrationType as IntegrationType,
            formattedContent,
            debugLog
        },
        skills: normalizedSkills,
        options: {
            maxTurns: options?.maxTurns ?? 50,
            requireApproval: options?.requireApproval ?? false
        }
    }

    return { ok: true, normalized }
}
