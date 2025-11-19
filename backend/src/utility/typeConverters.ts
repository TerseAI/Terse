import { IntegrationType } from "../shared/Integrations";
import { IntegrationType as PrismaIntegrationType, RunHistoryIntegration } from "@prisma/client";

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
            throw integrationType satisfies never;
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
            throw prismaIntegrationType satisfies never;
    }
}

export const convertIntegrationTypeToRunHistoryIntegration = (integrationType: IntegrationType): RunHistoryIntegration => {
    switch (integrationType) {
        case IntegrationType.GITHUB:
            return RunHistoryIntegration.github;
        case IntegrationType.GMAIL:
            return RunHistoryIntegration.gmail;
        case IntegrationType.LINEAR:
            return RunHistoryIntegration.linear;
        case IntegrationType.ATLASSIAN:
            return RunHistoryIntegration.confluence; // ATLASSIAN maps to confluence in run history
        case IntegrationType.SLACK:
            return RunHistoryIntegration.slack;
        case IntegrationType.NOTION:
            return RunHistoryIntegration.notion;
        case IntegrationType.FIGMA:
            return RunHistoryIntegration.figma;
        default:
            throw integrationType satisfies never;
    }
}

export const convertRunHistoryIntegrationToIntegrationType = (runHistoryIntegration: RunHistoryIntegration): IntegrationType => {
    switch (runHistoryIntegration) {
        case RunHistoryIntegration.github:
            return IntegrationType.GITHUB;
        case RunHistoryIntegration.gmail:
            return IntegrationType.GMAIL;
        case RunHistoryIntegration.linear:
            return IntegrationType.LINEAR;
        case RunHistoryIntegration.confluence:
        case RunHistoryIntegration.jira:
            // Both map to ATLASSIAN in shared enum
            return IntegrationType.ATLASSIAN;
        case RunHistoryIntegration.slack:
            return IntegrationType.SLACK;
        case RunHistoryIntegration.notion:
            return IntegrationType.NOTION;
        case RunHistoryIntegration.figma:
            return IntegrationType.FIGMA;
        default:
            throw runHistoryIntegration satisfies never;
    }
}