import { Request, Response } from "express";
import { ConfigInstance, ConfigType } from "../shared/Configs";
import { InputEvent } from "../integrations/abstract/InputEvent";
import { IntegrationType } from "../shared/Integrations";
import { GmailEvent } from "../integrations/GmailIntegration";


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