import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { JiraAdapter } from "../ticketing/jira";

export const setJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { baseUrl, apiKey, email } = req.body;
    console.log(req.body);
    console.log("Attempting to set Jira credentials", baseUrl, email, apiKey);
    const valid = await JiraAdapter.validateCredentials(baseUrl, email, apiKey);
    if (!valid) {
        return res.status(400).json({ error: 'Invalid Jira credentials' });
    }

    await db().jira_api_keys.create({
        data: {
            user_id: user.id,
            jira_user_email: email,
            base_url: baseUrl,
            api_token: apiKey
        }
    });

    console.log(chalk.green('Stored Jira credentials for user'), chalk.yellow(user.id));
    res.status(200).json({ message: 'Credentials set' });
};

export const getJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        console.log(chalk.red('Unauthorized request to get Jira credentials'));
        return res.status(401).json({ apiKey: null, baseUrl: null, email: null });
    }

    const creds = await db().jira_api_keys.findUnique({ where: { user_id: user.id } });
    if (!creds) {
        console.log(chalk.red('No Jira credentials found for user'), chalk.yellow(user.id));
        return res.status(200).json({ apiKey: null, baseUrl: null, email: null });
    }

    const valid = await JiraAdapter.validateCredentials(creds.base_url, creds.jira_user_email, creds.api_token);
    if (!valid) {
        console.log(chalk.red('Invalid Jira credentials found for user'), chalk.yellow(user.id));
        await db().jira_api_keys.delete({ where: { user_id: user.id } });
        return res.status(200).json({ apiKey: null, baseUrl: null, email: null });
    }

    res.status(200).json({ apiKey: creds.api_token, baseUrl: creds.base_url, email: creds.jira_user_email });
};

export const deleteJiraCredentials = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    await db().jira_api_keys.delete({ where: { user_id: user.id } });
    console.log(chalk.green('Deleted Jira credentials for user'), chalk.yellow(user.id));
    res.status(200).json({ message: 'Credentials deleted' });
}