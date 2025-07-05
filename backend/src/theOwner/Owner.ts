import { EmbeddingSystem } from "src/search/EmbeddingSystem";
import { TicketManager } from "../ticketing/TicketIntegration";

class Owner {
    private ticketingSystem: TicketManager;
    private embeddingSystem: EmbeddingSystem;

    constructor(ticketingSystem: TicketManager, embeddingSystem: EmbeddingSystem) {
        this.ticketingSystem = ticketingSystem;
        this.embeddingSystem = embeddingSystem;
    }

    async handlePushEvent(event: PushEvent) {
        console.log('The owner is handling a push event', event);
    }
}

export default Owner;

export type PushEvent = {
    username: string;
    installationId: number;
    repositoryName: string;
    branch: string;
    commits: Commit[];
}

export type Commit = {
    name: string;
    fileDiffs: FileDiff[];
}

export type FileDiff = {
    filename: string;
    diff: string;
}