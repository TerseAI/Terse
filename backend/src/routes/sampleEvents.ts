import { Request, Response } from "express";
import { ConfigInstance, ConfigType } from "../shared/Configs";
import { GmailEvent } from "../integrations/GmailIntegration";
import { SampleEvent, GmailSampleEvent } from "../shared/SampleEvents";


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
    const sampleEvent = req.body as SampleEvent;
    if (!sampleEvent.integrationId || !sampleEvent.trigger || !sampleEvent.eventData) {
        return res.status(400).json({ error: 'sampleEvent is required' });
    }
    if (!req.session?.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    switch (sampleEvent.configType) {
        case ConfigType.GMAIL:
            return res.status(200).json(await GmailEvent.sendSampleEventToAgent(sampleEvent as GmailSampleEvent, req.session.user));
        default:
            return res.status(400).json({ error: 'Unsupported integration type' });
    }
}