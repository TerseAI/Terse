import { FigmaTrigger } from "./FigmaTrigger"
import { GithubTrigger } from "./GithubTrigger"
import { GmailTrigger } from "./GmailTrigger"
import { JiraTrigger } from "./JiraTrigger"
import { LinearTrigger } from "./LinearTrigger"
import { ScheduleTrigger } from "./ScheduleTrigger"
import { SlackTrigger } from "./SlackTrigger"
import { Trigger } from "./Trigger"
import { WorkOSTrigger } from "./WorkOSTrigger"

export const TRIGGER_REGISTRY: Trigger<any>[] = [
    new GmailTrigger(),
    new SlackTrigger(),
    new FigmaTrigger(),
    new GithubTrigger(),
    new LinearTrigger(),
    new JiraTrigger(),
    new ScheduleTrigger(),
    new WorkOSTrigger()
]
