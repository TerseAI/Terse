import { IntegrationType } from "../shared/Integrations";
import { IntegrationType as PrismaIntegrationType } from "@prisma/client";

export const convertIntegrationTypeToPrismaIntegrationType = (integrationType: IntegrationType): PrismaIntegrationType => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return PrismaIntegrationType.GITHUB;
        case IntegrationType.GMAIL:
            return PrismaIntegrationType.GMAIL;
        case IntegrationType.LINEAR:
            return PrismaIntegrationType.LINEAR;
        case IntegrationType.ATLASSIAN:
            return PrismaIntegrationType.JIRA;
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

export const convertPrismaIntegrationTypeToIntegrationType = (prismaIntegrationType: PrismaIntegrationType): IntegrationType => {
    switch (prismaIntegrationType) {
        case PrismaIntegrationType.GITHUB:
            return IntegrationType.GITHUB;
        case PrismaIntegrationType.GMAIL:
            return IntegrationType.GMAIL;
        case PrismaIntegrationType.LINEAR:
            return IntegrationType.LINEAR;
        case PrismaIntegrationType.JIRA:
        case PrismaIntegrationType.CONFLUENCE:
            // Both JIRA and CONFLUENCE map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN;
        case PrismaIntegrationType.SLACK:
            return IntegrationType.SLACK;
        case PrismaIntegrationType.NOTION:
        case PrismaIntegrationType.NOTION_PAGE:
            // Both NOTION and NOTION_PAGE map to NOTION in shared enum
            return IntegrationType.NOTION;
        case PrismaIntegrationType.FIGMA:
            return IntegrationType.FIGMA;
        default:
            throw new Error(`Unknown Prisma integration type: ${prismaIntegrationType}`);
    }
}