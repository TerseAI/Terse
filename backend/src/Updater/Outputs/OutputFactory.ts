import { IntegrationType } from "@prisma/client";
import { Output } from "./Output";
import { NotionDatabaseOutput } from "./NotionDatabaseOutput";
import { NotionPageOutput } from "./NotionPageOutput";
import { Session } from "../../server";
import { ConfluenceOutput } from "./ConfluenceOutput";

/**
 * Factory for creating Output instances based on IntegrationType.
 * Uses a registry pattern to map integration types to their corresponding Output implementations.
 * No switch statements - each output type is registered independently.
 */
export class OutputFactory {
    private static readonly outputRegistry: Map<IntegrationType, () => Output<Session>> = new Map<IntegrationType, () => Output<Session>>([
        [IntegrationType.NOTION, () => new NotionDatabaseOutput()],
        [IntegrationType.NOTION_PAGE, () => new NotionPageOutput()],
        [IntegrationType.CONFLUENCE, () => new ConfluenceOutput()]
    ]);

    /**
     * Create an Output instance for the given integration type.
     * @param integrationType The integration type to create an output for
     * @returns An Output instance, or null if the integration type is not supported
     */
    static createOutput(integrationType: IntegrationType): Output<Session> | null {
        const factory = this.outputRegistry.get(integrationType);
        if (!factory) {
            return null;
        }
        return factory();
    }

    /**
     * Check if an integration type is supported as an output.
     * @param integrationType The integration type to check
     * @returns true if the integration type is supported as an output
     */
    static isSupported(integrationType: IntegrationType): boolean {
        return this.outputRegistry.has(integrationType);
    }
}