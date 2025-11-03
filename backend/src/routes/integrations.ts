import { Request, Response } from "express";
import { db } from "../prismaClient";
import { IntegrationsStatus } from "../shared/types";

export async function fetchUserIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const result: any = { integrations: {} };

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
                api_key: true
            }
        });
        result.integrations.linear = linearKeys.map(lk => ({
            id: lk.id,
            workspaceId: lk.workspace_id,
            workspaceName: lk.workspace_name,
            teamId: lk.team_id,
            teamName: lk.team_name,
            apiKey: lk.api_key
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
                api_token: true
            }
        });
        result.integrations.jira = jiraKeys.map(jk => ({
            id: jk.id,
            baseUrl: jk.base_url,
            siteName: jk.site_name,
            projectKey: jk.project_key,
            projectName: jk.project_name,
            email: jk.jira_user_email,
            apiKey: jk.api_token
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
                integration_token: true
            }
        });
        result.integrations.notion = notionIntegrations.map(ni => ({
            id: ni.id,
            workspaceId: ni.workspace_id,
            workspaceName: ni.workspace_name,
            integrationToken: ni.integration_token
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching integrations status:', error);
        res.status(500).json({ error: 'Failed to fetch integrations status' });
    }
}