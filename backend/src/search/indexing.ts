import { Project, Ticket } from "../shared/TicketSystem";
import { TicketManager } from "../ticketing/TicketIntegration";
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
    await this.indexTickets(tickets);
    console.log(chalk.green("Indexed"), tickets.length, "tickets");

    const projects = await this.ticketManager.getAllProjects();
    await this.indexProjects(projects);
    console.log(chalk.green("Indexed"), projects.length, "projects");
  }

  async indexTickets(tickets: Ticket[]) {
    console.log(chalk.blue("Indexing"), tickets.length, "tickets");
    for (const ticket of tickets) {
      const searchItems: SearchItem[] = await this.ticketManager.searchItemsForTicket(ticket.id);
      await this.search.bulkInsert(searchItems);
    }
  }

  async indexProjects(projects: Project[]) {
    console.log(chalk.blue("Indexing"), projects.length, "projects");
    for (const project of projects) {
      const searchItems: SearchItem[] = await this.ticketManager.searchItemsForProject(project.id);
      await this.search.bulkInsert(searchItems);
    }
  }
}

export default Indexing;
