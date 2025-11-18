import { IntegrationType } from "../shared/types";
import { IntegrationType as PrismaIntegrationType } from "@prisma/client";

export const convertIntegrationTypeToPrismaIntegrationType = (integrationType: IntegrationType): PrismaIntegrationType => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return PrismaIntegrationType.GITHUB;
        case IntegrationType.GMAIL:
            return PrismaIntegrationType.GMAIL;
        case IntegrationType.LINEAR:
            return PrismaIntegrationType.LINEAR;
        case IntegrationType.JIRA:
            return PrismaIntegrationType.JIRA;
        case IntegrationType.CONFLUENCE:
            return PrismaIntegrationType.CONFLUENCE;
        case IntegrationType.SLACK:
            return PrismaIntegrationType.SLACK;
        case IntegrationType.NOTION:
            return PrismaIntegrationType.NOTION;
        case IntegrationType.FIGMA:
            return PrismaIntegrationType.FIGMA;
        default:
            throw new Error(`Unknown integration type: ${integrationType}`);
    }
}