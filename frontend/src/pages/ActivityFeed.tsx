import { useEffect, useState } from "react";
import { InboxIcon } from "@heroicons/react/24/outline";
import AvatarBar from "../components/activity/AvatarBar";
import Card from "../components/Card";
import { ActivityEvent } from "../shared/types";
import { ActivityFeedService } from "../services/activityFeed";
import EventDetails from "../components/activity/EventDetails";

function ActivityFeed() {
    const [activity, setActivity] = useState<ActivityEvent[]>([]);

    useEffect(() => {
        const fetchActivity = async () => {
            const data = await ActivityFeedService.getActivityFeed();
            setActivity(data.activities);
        }

        fetchActivity();
    }, []);

    return (
        <div className="pt-4 pb-4">
            <h1 className="text-4xl font-bold pb-8">Activity Feed</h1>
            <div className="flex flex-col gap-4 animate-fade-in">
                <FeedContent activity={activity} />
            </div>
        </div>
    )
}

function FeedContent({ activity }: { activity: ActivityEvent[] }) {
    if (activity.length === 0) {
        return emptyActivityFeed();
    }

    return (
        activity.map((event, index) => (
            <Card key={index}>
                <div className="space-y-4">
                    {/* Header with avatar, repo info, and date */}
                    <div className="flex justify-between">
                        <AvatarBar event={event} />
                        <EventDetails event={event} />
                    </div>

                    <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {event.title}
                        </h4>
                    </div>
                </div>
            </Card>
        ))
    )
}

function emptyActivityFeed() {
    return (
        <div className="w-full min-h-screen grid place-items-center animate-fade-in">
            <div className="grid place-items-center">
                <InboxIcon className="w-8 h-8 text-[theme(accent)] mb-4" />
                <h1 className="text-xl font-bold pb-2 text-[theme(text-primary)]">No activity yet</h1>
                <p className="text-[theme(text-secondary)]">
                    Push a commit, open a PR, or merge a PR to see your activity here.
                </p>
            </div>
        </div >
    )
}


export default ActivityFeed;