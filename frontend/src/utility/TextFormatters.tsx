import { ActivityEvent } from "../shared/types"

const formatEventTitle = (event: ActivityEvent) => {
    console.log(event.event_type)
    switch (event.event_type) {
        case "PUSH":
            return `Pushed ${event.sub_activities.length} commits`
        case "PULL_REQUEST_MERGED":
            return `PR Merged`
        case "PULL_REQUEST_OPENED":
            return `PR Opened`
        case "PULL_REQUEST_UPDATED":
            return `PR Updated`
        case "PULL_REQUEST_CLOSED":
            return `PR Closed`
        default:
            return event.title
    }
}

const getEventBadgeStyle = (eventType: ActivityEvent["event_type"]) => {
    switch (eventType) {
        case "PUSH":
            return "text-purple-600 dark:text-purple-400"
        case "PULL_REQUEST_MERGED":
            return "text-green-600 dark:text-green-400"
        case "PULL_REQUEST_OPENED":
            return "text-blue-600 dark:text-blue-400"
        case "PULL_REQUEST_UPDATED":
            return "text-amber-600 dark:text-amber-400"
        case "PULL_REQUEST_CLOSED":
            return "text-gray-600 dark:text-gray-400"
        default:
            return "text-muted-foreground"
    }
}

export { formatEventTitle, getEventBadgeStyle }
