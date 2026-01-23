import { Request, Response } from "express";
import { ConfigInstance, ConfigType } from "../shared/Configs";
import { GmailEvent } from "../integrations/GmailIntegration";
import { SampleEvent, GmailSampleEvent, AgentSampleEvent } from "../shared/SampleEvents";


export async function getSampleEvents(req: Request, res: Response) {
    const config = req.body as ConfigInstance;
    if (!config.integrationType || !config.integrationId) {
        return res.status(400).json({ error: 'config is required' });
    }
    switch (config.configType) {
        case ConfigType.GMAIL:
            return res.status(200).json(await GmailEvent.getSampleEvents(config));
        default:
            return res.status(400).json({ error: 'Unsupported integration type' });
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
            default:
                return res.status(400).json({ error: 'Unsupported integration type' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Error sending sample event to agent' });
    }
}