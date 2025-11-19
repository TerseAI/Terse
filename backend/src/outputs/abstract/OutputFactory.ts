import { IntegrationType, OutputConfigType } from "@prisma/client";
import { Output } from "./Output";
import { NotionDatabaseOutput } from "../NotionDatabaseOutput";
import { NotionPageOutput } from "../NotionPageOutput";
import { Session } from "../../server";
import { ConfluenceOutput } from "../ConfluenceOutput";

/**
 * Factory for creating Output instances based on IntegrationType.
 * Uses a registry pattern to map integration types to their corresponding Output implementations.
 * No switch statements - each output type is registered independently.
 */
export class OutputFactory {
    private static readonly OUTPUT_REGISTRY: Map<OutputConfigType, () => Output<Session>> = new Map<OutputConfigType, () => Output<Session>>([
        [OutputConfigType.NOTION_DATABASE, () => new NotionDatabaseOutput()],
        [OutputConfigType.NOTION_PAGE, () => new NotionPageOutput()],
        [OutputConfigType.CONFLUENCE, () => new ConfluenceOutput()]
    ]);

    /**
     * Create an Output instance for the given integration type.
     * @param integrationType The integration type to create an output for
     * @returns An Output instance, or null if the integration type is not supported
     */
    static createOutput(integrationType: OutputConfigType): Output<Session> | null {
        const factory = this.OUTPUT_REGISTRY.get(integrationType);
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
    static isSupported(integrationType: OutputConfigType): boolean {
        return this.OUTPUT_REGISTRY.has(integrationType);
    }
}