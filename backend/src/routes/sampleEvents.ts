import { Request, Response } from "express";
import { ConfigInstance } from "../shared/Configs";
import { AgentSampleEvent } from "../shared/SampleEvents";
import { InputEventRegistry } from "../integrations/abstract/InputEventRegistry";


export async function getSampleEvents(req: Request, res: Response) {
    const config = req.body as ConfigInstance;
    if (!config.integrationType || !config.integrationId) {
        return res.status(400).json({ error: 'config is required' });
    }

    try {
        const handler = InputEventRegistry.getEventHandler(config.configType);
        return res.status(200).json(await handler.getSampleEvents(config));
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
    if (!agentId || !sampleEvent.integrationId || !sampleEvent.trigger || !sampleEvent.eventData) {
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