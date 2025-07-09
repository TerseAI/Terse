import { TicketManager } from "src/ticketing/TicketIntegration";
import { Search } from "./search";
import { SearchItem } from "./SearchItem";
import chalk from "chalk";

class Indexing {
    private search: Search;
    private ticketManager: TicketManager;

    constructor(search: Search, ticketManager: TicketManager) {
        this.search = search;
        this.ticketManager = ticketManager;
    }

    async index() {
        const tickets = await this.ticketManager.getAllTickets();
        console.log(chalk.blue('Indexing'), tickets.length, 'tickets');
        for (const ticket of tickets) {
            const searchItems: SearchItem[] = await this.ticketManager.searchItemsForTicket(ticket.id);
            await this.search.bulkInsert(searchItems);
        }
        console.log(chalk.green('Indexed'), tickets.length, 'tickets');
    }
}

export default Indexing;