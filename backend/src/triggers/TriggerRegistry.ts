import { GithubTrigger } from "./GithubTrigger"
import { GmailTrigger } from "./GmailTrigger"
import { LinearTrigger } from "./LinearTrigger"
import { ScheduleTrigger } from "./ScheduleTrigger"
import { SlackTrigger } from "./SlackTrigger"
import { Trigger } from "./Trigger"
import { WebMonitorTrigger } from "./WebMonitorTrigger"
import { WebhookTrigger } from "./WebhookTrigger"
import { WorkOSTrigger } from "./WorkOSTrigger"

export const TRIGGER_REGISTRY: Trigger<any>[] = [
    new GmailTrigger(),
    new SlackTrigger(),
    new GithubTrigger(),
    new LinearTrigger(),
    new ScheduleTrigger(),
    new WebMonitorTrigger(),
    new WorkOSTrigger(),
    new WebhookTrigger()
]
