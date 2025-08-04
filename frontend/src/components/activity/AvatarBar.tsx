import { ActivityEvent } from "../../shared/types";
import GitHubAvatar from "../ui/GithubAvatar";

function AvatarBar({ event }: { event: ActivityEvent }) {
    return (
        <div className="flex items-center gap-3">
            <GitHubAvatar username={event.github_repository_owner_id} size={48} />
            <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {event.github_repository_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.github_repository_owner_id}
                </p>
            </div>
        </div>
    )
}

export default AvatarBar;