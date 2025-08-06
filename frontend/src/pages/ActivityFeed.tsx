import { useEffect, useState } from "react";
import { InboxIcon } from "@heroicons/react/24/outline";
import AvatarBar from "../components/activity/AvatarBar";
import Card from "../components/Card";
import { ActivityEvent, SubActivity } from "../shared/types";
import { ActivityFeedService } from "../services/activityFeed";
import EventDetails from "../components/activity/EventDetails";
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

function ActivityFeed() {
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchActivity = async () => {
            setIsLoading(true);
            const data = await ActivityFeedService.getActivityFeed();
            setActivity(data.activities);
            setIsLoading(false);
        }

        fetchActivity();
    }, []);

    return (
        <div className="pt-4 pb-4">
            <h1 className="text-4xl font-bold pb-8">Activity Feed</h1>
            <div className="flex flex-col gap-4 animate-fade-in">
                {isLoading ? <div className="grid place-items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[theme(text-primary)]"></div>
                </div> : <FeedContent activity={activity} />}
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
                <div className="grid grid-flow-row gap-4">
                    {/* Header with avatar, repo info, and date */}
                    <div className="flex justify-between">
                        <AvatarBar event={event} />
                        <EventDetails event={event} />
                    </div>

                    <div className="grid grid-flow-row gap-2">
                        <h4 className="font-medium text-[theme(text-primary)]">
                            {event.title}
                        </h4>
                        <SubActivityEvents event={event} />
                    </div>
                </div>
            </Card>
        ))
    )
}

function SubActivityEvents({ event }: { event: ActivityEvent }) {
    return (
        <div className="transition duration-200">
            <Disclosure>
                {({ open }) => (
                    <>
                        <DisclosureButton>
                            <div className="flex justify-between">
                                <p>3 commits</p>
                                <ChevronDownIcon className={clsx('w-5', open && 'rotate-90')} />
                            </div>
                        </DisclosureButton>
                        <DisclosurePanel
                            transition
                            className="origin-top transition duration-200 ease-out data-closed:-translate-y-6 data-closed:opacity-0"
                        >
                            <div className="mt-2 ml-4 border-l-2 border-[theme(text-secondary)] pl-4">
                                <p className="text-[theme(text-secondary)]">{event.sub_activities.map((subActivity, index) => (
                                    <div key={index} className="flex justify-between">
                                        <p className="text-[theme(text-secondary)]">{subActivity.summary}</p>
                                        <AssociatedCommits event={subActivity} />
                                    </div>
                                ))}</p>
                            </div>
                        </DisclosurePanel>
                    </>
                )}
            </Disclosure>
        </div>
    )
}

function AssociatedCommits({ event }: { event: SubActivity }) {
    return (
        <div>
            <h4 className="font-medium text-[theme(text-primary)]">
                {event.commits.map((commit, index) => (
                    <div key={index}>
                        <a href={commit.url} target="_blank" rel="noopener noreferrer">
                            {commit.message}
                        </a>
                    </div>
                ))}
            </h4>
        </div>
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