import { ActivityEvent } from "../../shared/types";
import moment from "moment";
import { formatEventTitle } from "../../utility/TextFormatters";

function EventDetails({ event }: { event: ActivityEvent }) {
    return (
        <div className="grid auto-cols-max grid-flow-col gap-2">
            <div>
                <span className="text-sm p-2 bg-green-800 rounded-md">
                    {formatEventTitle(event)}
                </span>
            </div>
            <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {moment(event.created_at).format('MMM D, YYYY')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                    {moment(event.created_at).format('h:mm A')}
                </p>
            </div>
        </div>
    )
}

export default EventDetails;