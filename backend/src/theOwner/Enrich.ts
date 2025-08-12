import { Session } from "../../src/server";
import chalk from "chalk";


export async function enrich(branch: string, commitMessage: string, session: Session) {
    if (!session.ticketManager) {
        console.error(chalk.red.bold("✗ No ticket manager found. Unable to enrich activity event."));
        return;
    }
    let linearTicket = extractLinearTicketFromBranchName(branch);
    if (linearTicket) {
        console.log(chalk.green("✓ Linear ticket found in branch name"), linearTicket);
    }   

    if (!linearTicket) { 
        linearTicket = extractLinearTicketFromCommitMessage(commitMessage);
    }

    if (!linearTicket) {
        console.error(chalk.red.bold("✗ No linear ticket found. Unable to enrich activity event."));
        return;
    }

    let ticketManager = session.ticketManager;

    // Fetch the issue from linear
    const tickets = await ticketManager.getTickets([linearTicket]);

    if (tickets.length === 0) {
        console.error(chalk.red.bold("✗ No linear ticket found. Unable to enrich activity event."));
        return;
    }

    console.log(chalk.green("✓ Tickets for enrich"), tickets);

    // Check if there is a project associated with the ticket
    const project = tickets[0].project;
    if (!project) {
        console.error(chalk.red.bold("✗ No project found. Unable to enrich activity event."));
        return;
    }

    // Grab the project information from linear
    const projects = await ticketManager.getAllProjects();
    const projectInfo = projects.find(p => p.id === project.id);
    console.log(chalk.green("✓ Project info for enrich"), projectInfo);
}

// Utility
function extractLinearTicketFromBranchName(branchName: string) {
    console.log(chalk.green("✓ Branch name for enrich"), branchName);
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

