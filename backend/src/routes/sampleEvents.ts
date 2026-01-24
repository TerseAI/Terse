import { Request, Response } from "express";
import { ConfigInstance, ConfigType, SlackConfig } from "../shared/Configs";
import { GmailEvent } from "../integrations/GmailIntegration";
import { SampleEvent, GmailSampleEvent, AgentSampleEvent, SlackSampleEvent } from "../shared/SampleEvents";
import { SlackEvent } from "../integrations/SlackIntegration";


export async function getSampleEvents(req: Request, res: Response) {
    const config = req.body as ConfigInstance;
    if (!config.integrationType || !config.integrationId) {
        return res.status(400).json({ error: 'config is required' });
    }

    try {
        switch (config.configType) {
            case ConfigType.GMAIL:
                return res.status(200).json(await GmailEvent.getSampleEvents(config));
            case ConfigType.SLACK:
                return res.status(200).json(await SlackEvent.getSampleEvents(config as SlackConfig));
            default:
                return res.status(400).json({ error: 'Unsupported integration type' });
        }
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
        switch (sampleEvent.configType) {
            case ConfigType.GMAIL:
                await GmailEvent.sendSampleEventToAgent(sampleEvent as GmailSampleEvent, agentId, req.session.user)
                return res.status(200).json({ message: 'Sample event sent to agent' });
            case ConfigType.SLACK:
                await SlackEvent.sendSampleEventToAgent(sampleEvent as SlackSampleEvent, agentId, req.session.user)
                return res.status(200).json({ message: 'Sample event sent to agent' });
            default:
                return res.status(400).json({ error: 'Unsupported integration type' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Error sending sample event to agent' });
    }
}