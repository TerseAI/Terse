import { ConfigType } from "@/shared/Configs"

import { AttioOutputIntegration } from "./AttioOutputIntegration"
import { ConfluenceIntegration } from "./ConfluenceIntegration"
import { FigmaIntegration } from "./FigmaIntegration"
import { GitHubIntegration } from "./GitHubIntegration"
import { GmailIntegration } from "./GmailIntegration"
import { GmailOutputIntegration } from "./GmailOutputIntegration"
import { JiraIntegration } from "./JiraIntegration"
import { LinearInputIntegration } from "./LinearInputIntegration"
import { LinearOutputIntegration } from "./LinearOutputIntegration"
import { NotionIntegration } from "./NotionIntegration"
import { SlackIntegration } from "./SlackIntegration"
import { SlackOutputIntegration } from "./SlackOutputIntegration"
import { TimeTriggerIntegration } from "./TimeTriggerIntegration"
import { WorkOSIntegration } from "./WorkOSIntegration"
import { InputConfigSelectorProps } from "./types"

export function IntegrationSelector(props: InputConfigSelectorProps) {
    switch (props.input.config?.configType || props.input.configType) {
        case ConfigType.GMAIL:
            return <GmailIntegration {...props} />

        case ConfigType.GMAIL_OUTPUT:
            return <GmailOutputIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.NOTION:
            return <NotionIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.SLACK:
            return <SlackIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.SLACK_OUTPUT:
            return <SlackOutputIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.GITHUB:
            return <GitHubIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.FIGMA:
            return <FigmaIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.LINEAR_INPUT:
            return <LinearInputIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />
        case ConfigType.LINEAR_OUTPUT:
            return <LinearOutputIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.JIRA:
            return <JiraIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.CONFLUENCE:
            return <ConfluenceIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.TIME_TRIGGER:
            return <TimeTriggerIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.WORKOS_INPUT:
            return <WorkOSIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        case ConfigType.ATTIO_OUTPUT:
            return <AttioOutputIntegration input={props.input} variant={props.variant} setConfig={props.setConfig} />

        default:
            throw new Error(`Unsupported config type: ${props.input.configType}`)
    }
}
