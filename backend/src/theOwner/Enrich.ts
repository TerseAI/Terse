import { ActivityEvent } from "src/types/prisma";
import { Session } from "../../src/server";

async function enrich(branch: string, commitMessage: string, session: Session) {
    if (!session.ticketManager) {
        console.error("No ticket manager found. Unable to enrich activity event.");
        return;
    }
    let linearTicket = extractLinearTicketFromBranchName(branch);
    if (linearTicket) {
    }   

    if (!linearTicket) { 
        linearTicket = extractLinearTicketFromCommitMessage(commitMessage);
    }

    if (!linearTicket) {
        console.error("No linear ticket found. Unable to enrich activity event.");
        return;
    }

    let ticketManager = session.ticketManager;

    // Fetch the issue from linear
    const tickets = await ticketManager.getTickets([linearTicket]);

    if (tickets.length === 0) {
        console.error("No linear ticket found. Unable to enrich activity event.");
        return;
    }

    console.log("tickets for enrich", tickets);

    // Check if there is a project associated with the ticket
    const project = tickets[0].project;
    if (!project) {
        console.error("No project found. Unable to enrich activity event.");
        return;
    }

    // Grab the project information from linear
    const projects = await ticketManager.getAllProjects();
    const projectInfo = projects.find(p => p.id === project.id);
    console.log("projectInfo for enrich", projectInfo);
}

// Utility
function extractLinearTicketFromBranchName(branchName: string) {
    const linearTicketRegex = /(?:LT-)?(\d+)/;
    const match = branchName.match(linearTicketRegex);
    return match ? match[1] : null;
}

function extractLinearTicketFromCommitMessage(commitMessage: string) {
    const linearTicketRegex = /(?:LT-)?(\d+)/;
    const match = commitMessage.match(linearTicketRegex);
    return match ? match[1] : null;
}

