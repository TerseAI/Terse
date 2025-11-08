import { db } from "../prismaClient";
import { Request, Response } from "express";
import { ConfluenceClient } from 'confluence.js';
import chalk from "chalk";

export async function setConfluenceCredentials(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { baseUrl, apiKey, email } = req.body;
    if (!baseUrl || !apiKey || !email) {
        return res.status(400).json({ success: false, error: 'baseUrl, apiKey, and email are required' });
    }

    try {
        const valid = await validateConfluenceCredentialsPrivate(email, baseUrl, apiKey);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }

        // Extract site name from baseUrl
        let siteName = baseUrl;
        const siteNameMatch = baseUrl.match(/https?:\/\/([^.]+)/);
        if (siteNameMatch) {
            siteName = siteNameMatch[1];
        }

        const connection = await db().jira_api_keys.create({
            data: {
                user_id: user.id,
                jira_user_email: email,
                base_url: baseUrl,
                site_name: siteName,
                api_token: apiKey,
            }
        });

        console.log(chalk.green('✅ Created Confluence integration:'), chalk.yellow(siteName));

        return res.status(200).json({
            success: true,
            connection: {
                id: connection.id,
                baseUrl: connection.base_url,
                siteName: connection.site_name,
                email: connection.jira_user_email,
            }
        });
    } catch (error) {
        console.error(chalk.red('Error creating Confluence connection:'), error);
        return res.status(500).json({ success: false, error: 'Failed to create connection' });
    }
}


export async function validateConfluenceCredentials(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { baseUrl, email, apiKey } = req.body;
    if (!baseUrl || !email || !apiKey) {
        return res.status(400).json({ success: false, error: 'baseUrl, email, and apiKey are required' });
    }

    const valid = await validateConfluenceCredentialsPrivate(email, baseUrl, apiKey);
    if (!valid) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    return res.status(200).json({ success: true });
}


async function validateConfluenceCredentialsPrivate(email: string, baseUrl: string, apiKey: string): Promise<boolean> {
    const client = new ConfluenceClient({
        host: baseUrl,
        authentication: {
            basic: {
                email: email,
                apiToken: apiKey,
            }
        },
    });
    const user = await client.users.getCurrentUser();
    console.log("Confluence user:", user);
    return user !== null;
}