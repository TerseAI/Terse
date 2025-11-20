import { IntegrationType, OutputConfigType } from "@prisma/client";
import { Output } from "./Output";
import { NotionDatabaseOutput } from "../NotionDatabaseOutput";
import { NotionPageOutput } from "../NotionPageOutput";
import { Session } from "../../server";
import { ConfluenceOutput } from "../ConfluenceOutput";
import { ConfigInstance } from "../../shared/Configs";

/**
 * Factory for creating Output instances based on IntegrationType.
 * Uses a registry pattern to map integration types to their corresponding Output implementations.
 * No switch statements - each output type is registered independently.
 */
export class OutputFactory {
    public static readonly OUTPUT_REGISTRY: Map<OutputConfigType, () => Output<Session, ConfigInstance>> = new Map<OutputConfigType, () => Output<Session, ConfigInstance>>([
        [OutputConfigType.NOTION_DATABASE, () => new NotionDatabaseOutput()],
        [OutputConfigType.NOTION_PAGE, () => new NotionPageOutput()],
        [OutputConfigType.CONFLUENCE, () => new ConfluenceOutput()]
    ]);

    /**
     * Create an Output instance for the given integration type.
     * @param integrationType The integration type to create an output for
     * @returns An Output instance, or null if the integration type is not supported
     */
    static createOutput(integrationType: OutputConfigType): Output<Session, ConfigInstance> | null {
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