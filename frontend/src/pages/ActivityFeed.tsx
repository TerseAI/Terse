import { useEffect, useState } from "react";
import { Inbox, ChevronRight } from "lucide-react";
import AvatarBar from "../components/activity/AvatarBar";
import { Card } from "../components/ui/card";
import { ActivityEvent, SubActivity, CommitAssociation } from "../shared/types";
import { ActivityFeedService } from "../services/activityFeed";
import EventDetails from "../components/activity/EventDetails";
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import clsx from 'clsx'

function ActivityFeed() {
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

    useEffect(() => {
        const fetchActivity = async () => {
            setIsLoading(true);
            const data = await ActivityFeedService.getActivityFeed({ limit: 20 });
            setActivity(data.activities);
            setHasMore(data.pagination.hasMore);
            setNextCursor(data.pagination.nextCursor);
            setIsLoading(false);
        }

        fetchActivity();
    }, []);

    const loadMore = async () => {
        if (!nextCursor || isLoadingMore) return;

        setIsLoadingMore(true);
        const data = await ActivityFeedService.getActivityFeed({
            cursor: nextCursor,
            limit: 20
        });
        setActivity([...activity, ...data.activities]);
        setHasMore(data.pagination.hasMore);
        setNextCursor(data.pagination.nextCursor);
        setIsLoadingMore(false);
    };

    // TODO: Better loading state with skeleton loading
    return (
        <div className="pt-4 pb-4">
            <h1 className="text-2xl font-bold pb-8">Activity Feed</h1>
            <div className="flex flex-col gap-4 animate-fade-in">
                <ActivityFeedContent
                    activity={activity}
                    isLoading={isLoading}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={loadMore}
                />
            </div>
        </div>
    )
}

function ActivityFeedContent({
    activity,
    isLoading,
    hasMore,
    isLoadingMore,
    onLoadMore
}: {
    activity: ActivityEvent[],
    isLoading: boolean,
    hasMore: boolean,
    isLoadingMore: boolean,
    onLoadMore: () => void
}) {
    if (isLoading) {
        return <LoadingState />
    }

    if (activity.length === 0) {
        return emptyActivityFeed();
    }

    return (
        <>
            <FeedContent activity={activity} />
            {hasMore && (
                <div className="flex justify-center pt-2">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="px-6 py-2 bg-card text-foreground rounded-lg hover:bg-accent/10 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm overflow-hidden"
                    >
                        {isLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}
        </>
    )
}

function LoadingState() {
    // three skeleton cards with pulse animation
    return (
        <div className="grid grid-cols-1 gap-4">
            <div className="animate-pulse rounded-lg bg-[theme(background)] h-24 w-full"></div>
            <div className="animate-pulse rounded-lg bg-[theme(background)] h-24 w-full"></div>
            <div className="animate-pulse rounded-lg bg-[theme(background)] h-24 w-full"></div>
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
                <div className="grid grid-flow-row gap-2">
                    {/* Header with avatar, repo info, and date */}
                    <div className="flex justify-between">
                        <AvatarBar event={event} />
                        <EventDetails event={event} />
                    </div>

                    <SubActivityEvents event={event} />
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
                        <DisclosureButton className="w-full">
                            <div className="flex justify-between items-center">
                                <h4 className="font-medium text-sm text-[theme(text-primary)]">
                                    {event.title}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-[theme(text-secondary)]">
                                    <span>{event.sub_activities.length} events</span>
                                    <ChevronRight className={clsx('w-4 h-4', open && 'rotate-90')} />
                                </div>
                            </div>
                        </DisclosureButton>
                        <DisclosurePanel>
                            <div className="mt-2 ml-4 border-l-2 border-[theme(text-secondary)] pl-4">
                                {event.sub_activities.map((subActivity, index) => (
                                    <SubActivityItem key={index} subActivity={subActivity} />
                                ))}
                            </div>
                        </DisclosurePanel>
                    </>
                )}
            </Disclosure>
        </div>
    )
}

function SubActivityItem({ subActivity }: { subActivity: SubActivity }) {
    return (
        <div className="mb-2">
            <Disclosure>
                {({ open }) => (
                    <>
                        <DisclosureButton className="w-full text-left">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-[theme(text-secondary)]">{subActivity.summary}</p>
                                <ChevronRight className={clsx('w-4 h-4 flex-shrink-0', open && 'rotate-90')} />
                            </div>
                        </DisclosureButton>
                        <DisclosurePanel>
                            <div className="">
                                <AssociatedCommits commits={subActivity.commits} />
                            </div>
                        </DisclosurePanel>
                    </>
                )}
            </Disclosure>
        </div>
    )
}

function AssociatedCommits({ commits }: { commits: CommitAssociation[] }) {
    return (
        <div className="space-y-2">
            {commits.map((commit, index) => (
                <div key={index} className="flex items-start space-x-2 p-2 bg-[theme(background-secondary)] rounded-md">
                    <div className="flex-shrink-0 w-2 h-2 bg-[theme(--color-accent)] rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                        <a
                            href={commit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[theme(text-primary)] text-sm hover:text-[theme(--color-accent)] transition-colors duration-200 break-words"
                        >
                            {commit.message}
                        </a>
                        <p className="text-[theme(text-secondary)] text-xs mt-1 font-mono">
                            {commit.sha.substring(0, 7)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    )
}

function emptyActivityFeed() {
    return (
        <div className="w-full grid place-items-center animate-fade-in">
            <div className="grid place-items-center">
                <Inbox className="w-8 h-8 text-[theme(--color-accent)] mb-4" />
                <h1 className="text-xl font-bold pb-2 text-[theme(text-primary)]">No activity yet</h1>
                <p className="text-[theme(text-secondary)]">
                    Push a commit, open a PR, or merge a PR to see your activity here.
                </p>
            </div>
        </div >
    )
}


export default ActivityFeed;