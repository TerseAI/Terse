import chalk from 'chalk';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { db } from '../prismaClient';

export function isValidSlackSig(req: Request) {
    const ts = req.headers['x-slack-request-timestamp'];
    const sig = req.headers['x-slack-signature'];
    const hmac = crypto
        .createHmac('sha256', process.env.SLACK_SIGNING_SECRET || '')
        .update(`v0:${ts}:${req.body}`)
        .digest('hex');
    return sig === `v0=${hmac}`;
}

export async function handleSlackEvent(req: Request, res: Response) {
    if (!isValidSlackSig(req)) return res.sendStatus(400);

    console.log(chalk.green('Slack event received', JSON.stringify(req.body)));

    // URL verification challenge
    if (req.body.type === 'url_verification') {
        return res.send(req.body.challenge);
    }

    const { team_id } = req.body;
    const ev = req.body.event;

    switch (ev.type) {
        case 'app_uninstalled':
            await markWorkspaceUninstalled(team_id); // delete tokens, close queues
            break;
        case 'tokens_revoked':
            await ev.tokens.bot?.forEach(deactivateToken);
            await ev.tokens.oauth?.forEach(deactivateToken);
            break;
    }
    res.sendStatus(200);
}

async function markWorkspaceUninstalled(team_id: string) {
    console.log(chalk.red('Workspace uninstalled. Deleting records from database...'));
    await db().user_slack_integrations.deleteMany({
        where: {
            slack_team_id: team_id
        }
    });

    await db().slack_integrations.deleteMany({
        where: {
            team_id: team_id
        }
    });

    console.log(chalk.green('Workspace uninstalled. Records deleted from database.'));
}

async function deactivateToken(token: string) {
    console.log(chalk.red('Token deactivated'));
}