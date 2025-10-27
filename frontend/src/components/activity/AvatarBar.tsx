import { ActivityEvent } from "../../shared/types";
import { formatEventTitle } from "../../utility/TextFormatters";
import GitHubAvatar from "../ui/GithubAvatar";

function AvatarBar({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-center gap-3">
      <GitHubAvatar username={event.github_repository_owner_id} size={48} />
      <div className="grid auto-cols-max grid-flow-col gap-3">
        <h3 className="font-semibold text-lg text-[theme(text-primary)]">
          {event.github_repository_name}
        </h3>
        <div>
          <span className="text-sm p-2 bg-[theme(background-elevated)] rounded-md">
            {formatEventTitle(event)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AvatarBar;
