import { type CreateEmailOptions, type ListTemplatesResponseSuccess, Resend, type Response as ResendResponse, type Template } from "resend"
import { ResendTemplate } from "terse-types"

function unwrap<T>(response: ResendResponse<T>): T {
    if (response.error) throw new Error(response.error.message)
    return response.data
}

function resendClient(apiKey: string): Resend {
    return new Resend(apiKey)
}

export async function listResendTemplates(apiKey: string): Promise<ResendTemplate[]> {
    const resend = resendClient(apiKey)
    const summaries: ListTemplatesResponseSuccess["data"] = []
    let after: string | undefined

    do {
        const page = unwrap(await resend.templates.list(after ? { limit: 100, after } : { limit: 100 }))
        summaries.push(...page.data)
        after = page.has_more && page.data.length > 0 ? page.data[page.data.length - 1].id : undefined
    } while (after)

    const published = summaries.filter(template => template.status === "published")
    const templates = await Promise.all(published.map(template => resend.templates.get(template.id).then(unwrap)))
    return templates.map(toCodegenTemplate)
}

function toCodegenTemplate(template: Template): ResendTemplate {
    return {
        id: template.id,
        alias: template.alias,
        name: template.name,
        status: template.status,
        variables: (template.variables ?? []).map(variable => ({
            key: variable.key,
            type: variable.type,
            fallbackValue: variable.fallback_value
        }))
    }
}

export async function sendResendTemplate(
    apiKey: string,
    input: {
        templateId: string
        to: string[]
        variables: Record<string, string | number>
        from?: string
        subject?: string
        replyTo?: string
        cc?: string[]
        bcc?: string[]
        idempotencyKey?: string
    }
): Promise<{ id: string }> {
    const payload: CreateEmailOptions = {
        to: input.to,
        template: { id: input.templateId, variables: input.variables }
    }
    if (input.from) payload.from = input.from
    if (input.subject) payload.subject = input.subject
    if (input.replyTo) payload.replyTo = input.replyTo
    if (input.cc?.length) payload.cc = input.cc
    if (input.bcc?.length) payload.bcc = input.bcc
    return unwrap(await resendClient(apiKey).emails.send(payload, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined))
}
