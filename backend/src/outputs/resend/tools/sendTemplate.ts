import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { sendResendTemplate } from "../../../integrations/resend/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"
import { getResendApiKeyByIntegrationId } from "../resendCredentials"

export const resendSendTemplateTool = defineSessionTool({
    name: "resend_send_template",
    execute: async ({ integrationId, templateId, to, variables, from, subject, replyTo, cc, bcc, idempotencyKey }, runContext) => {
        if (!runContext?.context) throw new Error("No context provided")
        const apiKey = await getResendApiKeyByIntegrationId(integrationId, runContext.context.user)
        if (!apiKey) throw new Error(`Resend integration not found or access denied for integrationId: ${integrationId}`)

        try {
            const result = await sendResendTemplate(apiKey, {
                templateId,
                to,
                variables,
                from: from ?? undefined,
                subject: subject ?? undefined,
                replyTo: replyTo ?? undefined,
                cc: cc ?? undefined,
                bcc: bcc ?? undefined,
                idempotencyKey: idempotencyKey ?? undefined
            })
            const summary = `Sent Resend template ${templateId} to ${to.join(", ")}`
            return {
                success: true,
                emailId: result.id,
                templateId,
                to,
                summary,
                actions: [
                    {
                        action: "Sent Resend template email",
                        integration: IntegrationType.RESEND,
                        target: to.join(", "),
                        details: summary,
                        url: `https://resend.com/emails/${result.id}`,
                        type: RunHistoryActionType.create,
                        isReadOnly: false
                    }
                ]
            }
        } catch (error) {
            logger.error("Failed to send Resend template", { error, integrationId, templateId })
            throw new Error(error instanceof Error ? `Failed to send Resend template: ${error.message}` : "Failed to send Resend template")
        }
    }
})
