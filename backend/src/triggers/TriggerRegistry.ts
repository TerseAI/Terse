import { AttioTrigger } from "./AttioTrigger"
import { DurableObjectTrigger } from "./DurableObjectTrigger"
import { GithubTrigger } from "./GithubTrigger"
import { GmailTrigger } from "./GmailTrigger"
import { HeyReachTrigger } from "./HeyReachTrigger"
import { LinearTrigger } from "./LinearTrigger"
import { ScheduleTrigger } from "./ScheduleTrigger"
import { SlackTrigger } from "./SlackTrigger"
import { Trigger } from "./Trigger"
import { WebMonitorTrigger } from "./WebMonitorTrigger"
import { WebhookTrigger } from "./WebhookTrigger"
import { WorkOSTrigger } from "./WorkOSTrigger"

export const TRIGGER_REGISTRY: Trigger<any>[] = [
    new DurableObjectTrigger(),
    new GmailTrigger(),
    new SlackTrigger(),
    new GithubTrigger(),
    new LinearTrigger(),
    new ScheduleTrigger(),
    new WebMonitorTrigger(),
    new WorkOSTrigger(),
    new WebhookTrigger(),
    new HeyReachTrigger(),
    new AttioTrigger()
]
