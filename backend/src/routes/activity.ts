import { Request, Response } from "express";
import { db } from "../prismaClient";
import { ActivityEvent, TicketActivityEvent as ClientTicketActivityEvent } from "../shared/types";
import { GithubRepository, TicketActivityEvent } from "../types/prisma";
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
    const activityEvents = await db().activity_events.findMany({
        where: {
            github_repository_id: {
                in: githubRepositories.map(repo => repo.id)
            }
        }
    });

    // for each activity event, get the ticket activity events
    const ticketActivityEvents: TicketActivityEvent[] = await db().ticket_activity_events.findMany({
        where: {
            activity_event_id: {
                in: activityEvents.map(event => event.id)
            }
        }
    });
    
    // let's take all of our ticket ids, and map them to tickets
    const ticketManager = await getUserTicketManager(user.id);
    if (!ticketManager) {
        return res.status(500).json({ error: "Ticket manager not found" });
    }
    const tickets = await ticketManager.getTickets(ticketActivityEvents.map(event => event.ticket_id));
    

    // create map of ticket id to ticket
    const ticketMap = new Map<string, Ticket>();
    for (const ticket of tickets) {
        ticketMap.set(ticket.id, ticket);
    }

    // Group em together
    const groupedActivityEvents: ActivityEvent[] = [];
    for (const activityEvent of activityEvents) {
        const ticketActivityEventsForEvent = ticketActivityEvents.filter(ticketEvent => ticketEvent.activity_event_id === activityEvent.id);
        const githubRepository: GithubRepository | undefined = githubRepositories.find(repo => repo.id === activityEvent.github_repository_id);

        groupedActivityEvents.push({
            event_type: activityEvent.event_type,
            title: activityEvent.title,
            github_repository_name: githubRepository?.name || 'Unknown',
            created_at: activityEvent.created_at,
            ticket_activity_events: ticketActivityEventsForEvent.map(ticketEvent => ({
                ticket: ticketMap.get(ticketEvent.ticket_id)!, // non-null assertion, since TicketActivityEvent expects Ticket, not null
                event_type: ticketEvent.event_type,
                title: ticketEvent.title
            }))
        });
    }

    res.json(groupedActivityEvents);
}