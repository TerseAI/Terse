import { Project, Ticket } from "../shared/TicketSystem";
import { TicketManager } from "../ticketing/TicketIntegration";
import { Search } from "./search";
import { SearchItem } from "./SearchItem";
import chalk from "chalk";
import logger from "../logger";

class Indexing {
    private search: Search;
    private ticketManager: TicketManager;

    constructor(search: Search, ticketManager: TicketManager) {
        this.search = search;
        this.ticketManager = ticketManager;
    }

    async index() {
        const tickets = await this.ticketManager.getAllTickets();
        await this.indexTickets(tickets);
        logger.info('Indexed tickets', { count: tickets.length });

        const projects = await this.ticketManager.getAllProjects();
        await this.indexProjects(projects);
        logger.info('Indexed projects', { count: projects.length });
    }

    async indexTickets(tickets: Ticket[]) {
        logger.info('Indexing tickets', { count: tickets.length });
        for (const ticket of tickets) {
            const searchItems: SearchItem[] = await this.ticketManager.searchItemsForTicket(ticket.id);
            await this.search.bulkInsert(searchItems);
        }
    }

    async indexProjects(projects: Project[]) {
        logger.info('Indexing projects', { count: projects.length });
        for (const project of projects) {
            const searchItems: SearchItem[] = await this.ticketManager.searchItemsForProject(project.id);
            await this.search.bulkInsert(searchItems);
        }
    }
}

export default Indexing;