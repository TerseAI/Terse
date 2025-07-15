import { Request, Response } from "express";
import { db } from "../prismaClient";
import { ActivityEvent } from "../shared/types";
import { GithubRepository, ActivityEvent as PrismaActivityEvent, User, SubActivityEvent, SubActivityCommitAssociation } from "../types/prisma";

export async function getActivityFeed(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // get all github repositories for the user
    const userGithubRepositories = await db().user_github_repositories.findMany({
        where: {
            user_id: user.id
        }
    });

    const githubRepositories: GithubRepository[] = await db().github_repositories.findMany({
        where: {
            id: {
                in: userGithubRepositories.map(repo => repo.github_repository_id)
            }
        }
    });

    // get all activity events for the user with sub activities and commit associations
    const activityEvents = await db().activity_events.findMany({
        where: {
            github_repository_id: {
                in: githubRepositories.map(repo => repo.id)
            }
        },
        include: {
            sub_activity_events: {
                include: {
                    sub_activity_commit_associations: true
                }
            },
            users: true,
            github_repository: true
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    // Transform to client format
    const groupedActivityEvents: ActivityEvent[] = activityEvents.map(activityEvent => ({
        event_type: activityEvent.event_type,
        title: activityEvent.title,
        github_repository_owner_id: activityEvent.users?.github_username || 'Unknown',
        github_repository_name: activityEvent.github_repository?.name || 'Unknown',
        created_at: activityEvent.created_at,
        sub_activities: activityEvent.sub_activity_events.map((subActivity: any) => ({
            summary: subActivity.summary,
            commits: subActivity.sub_activity_commit_associations.map((commit: any) => ({
                sha: commit.commit_sha,
                message: commit.commit_message,
                url: commit.commit_url
            }))
        }))
    }));

    res.json(groupedActivityEvents);
}