import { Request, Response } from "express";
import { GithubIntegrationManager } from "../../integrations/GithubIntegration";
import logger from "../../logger";

export async function githubAppCallbackIntegrate(req: Request, res: Response) {
    logger.info('Github App OAuth callback received', { query: req.query });
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
        return res.status(400).send('Invalid OAuth state');
    }

    const integration = new GithubIntegrationManager();
    await integration.processInstallationCallback(req, res);
}
