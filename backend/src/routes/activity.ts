import { Request, Response } from "express";
import { db } from "../prismaClient";
import { ActivityEvent, TicketActivityEvent as ClientTicketActivityEvent } from "../shared/types";
import { GithubRepository, TicketActivityEvent, ActivityEvent as PrismaActivityEvent, User } from "../types/prisma";
import { getUserTicketManager } from "../types/user";
import { Ticket } from "../shared/TicketSystem";


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

    // get all activity events for the user
    const activityEvents: PrismaActivityEvent[] = await db().activity_events.findMany({
        where: {
            github_repository_id: {
                in: githubRepositories.map(repo => repo.id)
            }
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    // Take all user_ids and map them to github usernames
    const users = activityEvents.map(event => event.user_id);
    const userMap = new Map<string, User>();
    for (const user of users) {
        const userData = await db().users.findUnique({
            where: { id: user }
        });
        if (userData) {
            userMap.set(user, userData);
        }
    }

    // Group em together
    const groupedActivityEvents: ActivityEvent[] = [];
    for (const activityEvent of activityEvents) {
        const githubRepository: GithubRepository | undefined = githubRepositories.find(repo => repo.id === activityEvent.github_repository_id);

        groupedActivityEvents.push({
            event_type: activityEvent.event_type,
            title: activityEvent.title,
            github_repository_owner_id: userMap.get(activityEvent.user_id)?.github_username || 'Unknown',
            github_repository_name: githubRepository?.name || 'Unknown',
            created_at: activityEvent.created_at,
            ticket_activity_events: []
        });
    }

    res.json(groupedActivityEvents);
}