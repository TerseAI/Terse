import { JournalEventSchema } from "little-durable"
import type { AppendJournalEventParams, GetJournalEventParams, JournalEvent, JournalStore, ListJournalEventsByTypeParams, ListJournalEventsParams, PopJournalStepParams } from "little-durable"
import { Actor } from "little-durable-objects"

type WorkflowJournalActor = Pick<__TerseWorkflowJournal, "append" | "get" | "list" | "listByType" | "popStep">
type WorkflowJournalActorResolver = (runId: string) => WorkflowJournalActor

/** Internal durable actor that owns one workflow run's ordered journal. */
export class __TerseWorkflowJournal extends Actor {
    events: JournalEvent[] = []

    async list(): Promise<readonly JournalEvent[]> {
        return this.events
    }

    async listByType(eventType: JournalEvent["type"]): Promise<readonly JournalEvent[]> {
        return this.events.filter(event => event.type === eventType)
    }

    async get(eventId: string): Promise<JournalEvent | undefined> {
        return this.events.find(event => event.eventId === eventId)
    }

    async append(event: unknown): Promise<JournalEvent> {
        const validatedEvent = JournalEventSchema.parse(event)
        this.events.push(validatedEvent)
        return validatedEvent
    }

    async popStep(stepId: string): Promise<void> {
        const tailStart = incompleteStepTailStart(this.events, stepId)
        this.events.splice(tailStart)
    }
}

/** `little-durable` journal adapter backed by one durable actor per run ID. */
export class DurableObjectJournalStore implements JournalStore {
    constructor(private readonly actorForRun: WorkflowJournalActorResolver = runId => __TerseWorkflowJournal.get(runId)) {}

    list({ runId }: ListJournalEventsParams): Promise<readonly JournalEvent[]> {
        return this.actorForRun(runId).list()
    }

    listByType({ runId, eventType }: ListJournalEventsByTypeParams): Promise<readonly JournalEvent[]> {
        return this.actorForRun(runId).listByType(eventType)
    }

    get({ runId, eventId }: GetJournalEventParams): Promise<JournalEvent | undefined> {
        return this.actorForRun(runId).get(eventId)
    }

    append({ runId, event }: AppendJournalEventParams): Promise<JournalEvent> {
        return this.actorForRun(runId).append(event)
    }

    popStep({ runId, stepId }: PopJournalStepParams): Promise<void> {
        return this.actorForRun(runId).popStep(stepId)
    }
}

function incompleteStepTailStart(events: readonly JournalEvent[], stepId: string): number {
    let tailStart = events.length
    while (tailStart > 0) {
        const event = events[tailStart - 1]
        if (!("stepId" in event) || event.stepId !== stepId) break
        tailStart--
    }

    const tail = events.slice(tailStart)
    const [startedEvent, ...followingEvents] = tail
    if (startedEvent?.type !== "step.started" || followingEvents.some(event => event.type !== "step.failed")) {
        throw new Error(`Step "${stepId}" is not an incomplete step at the journal tail`)
    }
    return tailStart
}
