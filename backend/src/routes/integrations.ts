import { Request, Response } from "express";
import { db } from "../prismaClient";

export async function fetchUserIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const integrations: { [key: string]: any } = {};

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
                integrations.github = { repositoryName: repo.name };
            }
        }

        // Check Linear integration
        const linearKey = await db().linear_api_keys.findUnique({
            where: { user_id: user.id }
        });
        if (linearKey) {
            integrations.linear = { apiKey: linearKey.api_key };
        }

        // Check Jira integration
        const jiraKey = await db().jira_api_keys.findUnique({
            where: { user_id: user.id }
        });
        if (jiraKey) {
            integrations.jira = {
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
                integrations.slack = { teamName: slackIntegration.team_name };
            }
        }

        res.status(200).json({ integrations });
    } catch (error) {
        console.error('Error fetching integrations status:', error);
        res.status(500).json({ error: 'Failed to fetch integrations status' });
    }
}