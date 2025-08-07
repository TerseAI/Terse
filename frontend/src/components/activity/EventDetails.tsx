import { ActivityEvent } from "../../shared/types";
import moment from "moment";

function EventDetails({ event }: { event: ActivityEvent }) {
    return (
        <div className="grid auto-cols-max grid-flow-col gap-2">
            <div className="text-right">
                <p className="text-sm text-[theme(text-secondary)]">
                    {moment(event.created_at).format('MMM D, YYYY')}
                </p>
                <p className="text-xs text-[theme(text-secondary)]">
                    {moment(event.created_at).format('h:mm A')}
                </p>
            </div>
        </div>
    )
}

export default EventDetails;