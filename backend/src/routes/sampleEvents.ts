import { Request, Response } from "express";
import { ConfigInstance } from "../shared/Configs";
import { AgentSampleEvent, SampleEvent } from "../shared/SampleEvents";
import { InputEventRegistry } from "../integrations/abstract/InputEventRegistry";
import { filterEvent } from "../agent/AgentRunner/EventFilter";
import { createInputEventFromSampleEvent } from "../utility/typeConverters";
import { db } from "../prismaClient";
import { AgentPrompt } from "../types/prisma";


export async function addFilterResultsToSampleEvents(
    sampleEvents: SampleEvent[],
    agentPrompt: AgentPrompt,
    agentId: string
): Promise<AgentSampleEvent[]> {
    const filterPromises = sampleEvents.map(async (sampleEvent) => {
        try {
            const inputEvent = createInputEventFromSampleEvent(sampleEvent);
            const { result } = await filterEvent(inputEvent, agentPrompt, false);
            return result;
        } catch (error) {
            return null;
        }
    });

    const filterResults = await Promise.all(filterPromises);
    return sampleEvents.map((event, index) => ({
        sampleEvent: event,
        filterResult: filterResults[index] ?? { isRelevant: false, reason: 'Error filtering event', confidence: 0 },
        agentId: agentId,
    }))
}

export async function getSampleEvents(req: Request, res: Response) {
    const { agentId, ...config } = req.body as ConfigInstance & { agentId?: string };
    const userId = req.session?.user?.id; // Get userId from authenticated session

    if (!config.integrationType) {
        return res.status(400).json({ error: 'integrationType is required' });
    }

    // GitHub integration requires userId from session
    if (config.integrationType === 'github' && !userId) {
        return res.status(401).json({ error: 'Authentication required for GitHub sample events' });
    }

    try {
        const handler = InputEventRegistry.getEventHandler(config.configType);
        const sampleEvents = await handler.getSampleEvents(config, userId);

        const hasAgentAndUser = (
            agentId && userId
        )

        if (!hasAgentAndUser) {
            throw new Error('Agent and user are required');
        }
        const agent = await db().automations.findUnique({
            where: { id: agentId, user_id: userId },
            include: { prompt: true }
        });
        if (!agent || !agent?.prompt) {
            throw new Error('Agent and prompt are required');
        }
        const eventsWithFilters = await addFilterResultsToSampleEvents(sampleEvents, agent?.prompt, agentId);
        return res.status(200).json(eventsWithFilters);
    } catch (error: any) {
        // Use status code from error if available, otherwise default to 500
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || 'Failed to fetch sample events';

        return res.status(statusCode).json({ error: errorMessage });
    }
}

export async function sendSampleEventToAgent(req: Request, res: Response) {
    const agentSampleEvent = req.body as AgentSampleEvent;
    const { agentId, sampleEvent } = agentSampleEvent;
    if (!agentId || !sampleEvent || !sampleEvent.integrationId || !sampleEvent.trigger || !sampleEvent.eventData) {
        return res.status(400).json({ error: 'agentId and sampleEvent are required' });
    }
    if (!req.session?.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const handler = InputEventRegistry.getEventHandler(sampleEvent.configType);
        await handler.sendSampleEventToAgent(sampleEvent, agentId, req.session.user);
        return res.status(200).json({ message: 'Sample event sent to agent' });
    } catch (error) {
        return res.status(500).json({ error: 'Error sending sample event to agent' });
    }
}