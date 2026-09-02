import { DEFAULT_EXECUTION_REGION, type ExecutionRegion, executionRegionSchema } from "terse-types/ExecutionRegions"

import { db } from "../loaders/prisma"

function parseStoredExecutionRegion(value: string): ExecutionRegion {
    return executionRegionSchema.parse(value)
}

export async function getOrCreateOrganizationExecutionRegion(organizationId: string): Promise<ExecutionRegion> {
    const settings = await db().organization_settings.upsert({
        where: { organization_id: organizationId },
        create: {
            organization_id: organizationId,
            execution_region: DEFAULT_EXECUTION_REGION
        },
        update: {},
        select: { execution_region: true }
    })
    return parseStoredExecutionRegion(settings.execution_region)
}

export async function setOrganizationExecutionRegion(
    organizationId: string,
    executionRegion: ExecutionRegion
): Promise<{ previousExecutionRegion: ExecutionRegion; executionRegion: ExecutionRegion; changed: boolean }> {
    const existing = await db().organization_settings.findUnique({
        where: { organization_id: organizationId },
        select: { execution_region: true }
    })
    const previousExecutionRegion = existing ? parseStoredExecutionRegion(existing.execution_region) : DEFAULT_EXECUTION_REGION

    const updated = await db().organization_settings.upsert({
        where: { organization_id: organizationId },
        create: {
            organization_id: organizationId,
            execution_region: executionRegion
        },
        update: { execution_region: executionRegion },
        select: { execution_region: true }
    })
    const storedExecutionRegion = parseStoredExecutionRegion(updated.execution_region)

    return {
        previousExecutionRegion,
        executionRegion: storedExecutionRegion,
        changed: previousExecutionRegion !== storedExecutionRegion
    }
}
