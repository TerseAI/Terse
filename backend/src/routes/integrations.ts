import { Request, Response } from "express";
import { db } from "../prismaClient";
import { IntegrationsStatus } from "../shared/types";
import { GmailIntegrationManager } from "../integrations/GmailIntegration";
import { SlackIntegrationManager } from "../integrations/SlackIntegration";
import { FigmaIntegrationManager } from "../integrations/FigmaIntegration";
import { GithubIntegrationManager } from "../integrations/GithubIntegration";
import { LinearIntegrationManager } from "../integrations/LinearIntegration";
import { JiraIntegrationManager } from "../integrations/JiraIntegration";
import { NotionIntegrationManager } from "../integrations/NotionIntegration";
import { ConfluenceIntegrationManager } from "../integrations/ConfluenceIntegration";

export async function fetchUserIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const result: IntegrationsStatus = { integrations: {} };

    try {
        // Check GitHub integration
        const userGithubRepos = await db().user_github_repositories.findMany({
            where: { user_id: user.id },
            include: { github_repository: true }
        });
        result.integrations.github = userGithubRepos.map(ugr => ({
            id: ugr.github_repository.id,
            repositoryName: ugr.github_repository.name,
            owner: ugr.github_repository.owner
        }));

        // Check Linear integrations (now multiple)
        const linearKeys = await db().linear_api_keys.findMany({
            where: { user_id: user.id },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
                team_id: true,
                team_name: true,
            }
        });
        result.integrations.linear = linearKeys.map(lk => ({
            id: lk.id,
            workspaceId: lk.workspace_id,
            workspaceName: lk.workspace_name || undefined,
            teamId: lk.team_id,
            teamName: lk.team_name,
        }));

        // Check Jira integrations (now multiple)
        const jiraKeys = await db().jira_api_keys.findMany({
            where: { user_id: user.id },
            select: {
                id: true,
                base_url: true,
                site_name: true,
                project_key: true,
                project_name: true,
                jira_user_email: true,
            }
        });
        result.integrations.jira = jiraKeys.map(jk => ({
            id: jk.id,
            baseUrl: jk.base_url,
            siteName: jk.site_name || undefined,
            projectKey: jk.project_key || undefined,
            projectName: jk.project_name || undefined,
            email: jk.jira_user_email,
        }));

        result.integrations.confluence = jiraKeys.map(jk => ({
            id: jk.id,
            confluence_user_email: jk.jira_user_email,
            base_url: jk.base_url,
        }));
        
        // Check Slack integration
        const userSlackIntegrations = await db().user_slack_integrations.findMany({
            where: { user_id: user.id },
            include: { slack_integration: true }
        });
        result.integrations.slack = userSlackIntegrations.map(usi => ({
            id: usi.id,
            teamId: usi.slack_integration.team_id,
            teamName: usi.slack_integration.team_name
        }));

        // Check Gmail integrations (already supports multiple)
        const gmailIntegrations = await db().gmail_integrations.findMany({
            where: {
                user_id: user.id,
                is_active: true
            },
            select: {
                id: true,
                email: true,
                history_id: true,
                watch_expiration: true
            }
        });
        result.integrations.gmail = gmailIntegrations.map(gi => ({
            id: gi.id,
            email: gi.email,
            historyId: gi.history_id,
            watchExpiration: gi.watch_expiration
        }));

        // Check Notion integrations (now multiple)
        const notionIntegrations = await db().notion_integrations.findMany({
            where: { user_id: user.id },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
            }
        });
        result.integrations.notion = notionIntegrations.map(ni => ({
            id: ni.id,
            workspaceId: ni.workspace_id || undefined,
            workspaceName: ni.workspace_name || undefined,
        }));

        // Check Figma integrations
        const figmaIntegrations = await db().figma_integrations.findMany({
            where: { user_id: user.id },
            select: {
                id: true,
                figma_user_id: true,
                token_expiry: true
            }
        });
        result.integrations.figma = figmaIntegrations.map(fi => ({
            id: fi.id,
            figma_user_id: fi.figma_user_id,
            token_expiry: fi.token_expiry
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching integrations status:', error);
        res.status(500).json({ error: 'Failed to fetch integrations status' });
    }
}

export async function getGithubIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new GithubIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching GitHub integrations:', error);
        res.status(500).json({ error: 'Failed to fetch GitHub integrations' });
    }
}

export async function getFigmaIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new FigmaIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Figma integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Figma integrations' });
    }
}

export async function getJiraIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new JiraIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Jira integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Jira integrations' });
    }
}

export async function getLinearIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new LinearIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Linear integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Linear integrations' });
    }
}

export async function getNotionIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new NotionIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Notion integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Notion integrations' });
    }
}

export async function getConfluenceIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new ConfluenceIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Confluence integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Confluence integrations' });
    }
}

export async function getSlackIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new SlackIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Slack integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Slack integrations' });
    }
}

export async function getGmailIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new GmailIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Gmail integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Gmail integrations' });
    }
}