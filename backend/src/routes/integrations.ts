import { Request, Response } from "express";
import { db } from "../prismaClient";
import { IntegrationsStatus } from "../shared/types";

export async function fetchUserIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const result: IntegrationsStatus = { integrations: {} };

    try {
        // Check GitHub integration
        const userGithubRepo = await db().user_github_repositories.findFirst({
            where: { user_id: user.id }
        });
        if (userGithubRepo) {
            const repo = await db().github_repositories.findUnique({
                where: { id: userGithubRepo.github_repository_id }
            });
            if (repo) {
                result.integrations.github = { repositoryName: repo.name };
            }
        }

        // Check Linear integration
        const linearKey = await db().linear_api_keys.findUnique({
            where: { user_id: user.id }
        });
        if (linearKey) {
            result.integrations.linear = { apiKey: linearKey.api_key };
        }

        // Check Jira integration
        const jiraKey = await db().jira_api_keys.findUnique({
            where: { user_id: user.id }
        });
        if (jiraKey) {
            result.integrations.jira = {
                apiKey: jiraKey.api_token,
                baseUrl: jiraKey.base_url,
                email: jiraKey.jira_user_email
            };
        }

        // Check Slack integration
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { user_id: user.id }
        });
        if (userSlackIntegration) {
            const slackIntegration = await db().slack_integrations.findFirst({
                where: { team_id: userSlackIntegration.slack_team_id }
            });
            if (slackIntegration) {
                result.integrations.slack = { teamName: slackIntegration.team_name };
            }
        }

        // Check Gmail integration (get the first active one if multiple exist)
        const gmailIntegration = await db().gmail_integrations.findFirst({
            where: {
                user_id: user.id,
                is_active: true
            },
            orderBy: { created_at: 'desc' }
        });
        if (gmailIntegration) {
            result.integrations.gmail = {
                email: gmailIntegration.email,
                historyId: gmailIntegration.history_id,
                watchExpiration: gmailIntegration.watch_expiration
            };
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching integrations status:', error);
        res.status(500).json({ error: 'Failed to fetch integrations status' });
    }
}