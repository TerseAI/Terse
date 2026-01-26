import { Project, Ticket } from "../shared/TicketSystem";
import { Session } from "../types/session";
import chalk from "chalk";
import logger from "../logger";

export type EnrichmentResult = {
    ticket: Ticket;
    project: Project | null;
}

export async function enrich(branch: string, commitMessage: string, session: Session): Promise<EnrichmentResult | null> {
    if (!session.ticketManager) {
        logger.error("✗ No ticket manager found. Unable to enrich activity event.", { userId: session.user.id, branch, commitMessage: commitMessage.substring(0, 100) });
        return null;
    }
    let linearTicket = extractLinearTicketFromBranchName(branch);
    if (linearTicket) {
        logger.debug("✓ Linear ticket found in branch name", { linearTicket, branch, userId: session.user.id });
    }   

    if (!linearTicket) { 
        linearTicket = extractLinearTicketFromCommitMessage(commitMessage);
    }

    if (!linearTicket) {
        logger.warn("✗ No linear ticket found. Unable to enrich activity event.", { branch, commitMessage: commitMessage.substring(0, 100), userId: session.user.id });
        return null;
    }

    let ticketManager = session.ticketManager;

    // Fetch the issue from linear
    const tickets = await ticketManager.getTickets([linearTicket]);

    if (tickets.length === 0) {
        logger.warn("✗ No linear ticket found. Unable to enrich activity event.", { linearTicket, userId: session.user.id });
        return null;
    }

    logger.debug("✓ Tickets for enrich", { ticketCount: tickets.length, ticketIds: tickets.map(t => t.id), linearTicket, userId: session.user.id });

    // Check if there is a project associated with the ticket
    const project = tickets[0].project;
    if (!project) {
        logger.warn("✗ No project found. Unable to enrich activity event.", { ticketId: tickets[0].id, linearTicket, userId: session.user.id });
        return null;
    }

    // Grab the project information from linear
    const projects = await ticketManager.getAllProjects();
    const projectInfo = projects.find(p => p.id === project.id);
    logger.debug("✓ Project info for enrich", { projectId: project.id, projectName: projectInfo?.name, userId: session.user.id });

    return {
        ticket: tickets[0],
        project: projectInfo || null
    };
}

// Utility
function extractLinearTicketFromBranchName(branchName: string) {
    logger.debug("✓ Branch name for enrich", { branchName });
    // Updated regex to capture the full ticket identifier (e.g., ENG-123, LT-456)
    const linearTicketRegex = /([A-Z]+-\d+)/;
    const match = branchName.match(linearTicketRegex);
    return match ? match[1] : null;
}

function extractLinearTicketFromCommitMessage(commitMessage: string) {
    // Updated regex to capture the full ticket identifier (e.g., ENG-123, LT-456)
    const linearTicketRegex = /([A-Z]+-\d+)/;
    const match = commitMessage.match(linearTicketRegex);
    return match ? match[1] : null;
}

