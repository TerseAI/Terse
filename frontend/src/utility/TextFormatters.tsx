import { ActivityEvent } from "../shared/types";

const formatEventTitle = (event: ActivityEvent) => {
    console.log(event.event_type);
    switch (event.event_type) {
        case 'PUSH':
            return `Pushed ${event.sub_activities.length} commits`;
        case 'PULL_REQUEST_MERGED':
            return `PR Merged`;
        case 'PULL_REQUEST_OPENED':
            return `PR Opened`;
        case 'PULL_REQUEST_UPDATED':
            return `PR Updated`;
    }
}

export { formatEventTitle };