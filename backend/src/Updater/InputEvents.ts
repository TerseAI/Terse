import { GmailEventData } from "src/routes/gmail";

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
    data: GmailEventData;
    
    constructor(data: GmailEventData) {
        super(InputEventType.GmailEvent);
        this.data = data;
    }

    formatForAutomationAgent(): string {
        return `
        Incoming Email Event.

        Gmail Event:
        Subject: ${this.data.subject}
        From: ${this.data.from}
        To: ${this.data.to}
        Date: ${this.data.date}
        Message ID: ${this.data.messageId}
        Body: ${this.data.body}
        Snippet: ${this.data.snippet}
        `;
    }
}