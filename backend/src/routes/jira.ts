import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { JiraAdapter } from "../ticketing/jira";

export const setJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { baseUrl, email, apiToken } = req.body;
    const valid = await JiraAdapter.validateCredentials(baseUrl, email, apiToken);
    if (!valid) {
        return res.status(400).json({ error: 'Invalid Jira credentials' });
    }

    await db().jira_api_keys.create({
        data: {
            user_id: user.id,
            jira_user_email: email,
            base_url: baseUrl,
            api_token: apiToken
        }
    });

    console.log(chalk.green('Stored Jira credentials for user'), chalk.yellow(user.id));
    res.status(200).json({ message: 'Credentials set' });
};

export const getJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const creds = await db().jira_api_keys.findUnique({ where: { user_id: user.id } });
    if (!creds) {
        return res.status(404).json({ error: 'Jira credentials not found' });
    }

    const valid = await JiraAdapter.validateCredentials(creds.base_url, creds.jira_user_email, creds.api_token);
    if (!valid) {
        await db().jira_api_keys.delete({ where: { user_id: user.id } });
        return res.status(400).json({ error: 'Invalid Jira credentials removed' });
    }

    res.status(200).json({ baseUrl: creds.base_url, email: creds.jira_user_email });
};
