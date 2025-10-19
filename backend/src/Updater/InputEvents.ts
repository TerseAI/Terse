export enum InputEventType {
    GitHubEvent = "githubEvent",
    GmailEvent = "gmailEvent",
    SlackEvent = "slackEvent",
    EmailEvent = "emailEvent",
    CalendarEvent = "calendarEvent",
    TaskEvent = "taskEvent",
}

export class InputEvent {
    eventType: InputEventType;

    constructor(eventType: InputEventType) {
        this.eventType = eventType;
    }

    // This method will be used to format the Event into the format expected by the LLM. MUST BE A STRING
    formatForAutomationAgent(): string {
        return this.eventType;
    }
}

// MARK: - GMAIL Event
export class GmailEvent extends InputEvent {
    constructor() {
        super(InputEventType.GmailEvent);
    }

    formatForAutomationAgent(): string {
        return `
        You are a Gmail event.
        You are responsible for automating tasks based on the incoming events.
        You will be given the following information:
        - The incoming event
        - The changes made by the event
        - the files that were changed
        - the commit message
        - the author of the commit
        - the date of the commit
        - the branch the commit was made to
        - the repository the commit was made to
        - the organization the repository belongs to
        - the diff of the changes
        You will need to decide what to do based on the incoming event.
        You will need to use the tools provided to help you automate the task.
        You will need to return the result of the automation.
        `;
    }
}