import { RunContext, tool } from "@openai/agents";
import { SessionWithTracking } from "../agents/Analyzer";
import { z } from "zod";
import { ChangeEventType } from "src/shared/ModelEvents";
import { EntityType } from "src/shared/Entities";
import { Commit } from "src/theOwner/utility";

export const createActionSummaryTool = tool({
    name: 'Create Action Event',
    description: 'Create an action event',
    parameters: z.object({
        summary: z.string().describe('A summary of the event'),
        associatedCommits: z.union([z.array(z.number()), z.null()]).describe('The indices of commits to associate with this ticket (0-based, from the event context)'),
        associatedPullRequests: z.union([z.array(z.number()), z.null()]).describe('The indices of pull requests to associate with this ticket (0-based, from the event context)'),
    }), 
    execute: async ({summary, associatedCommits, associatedPullRequests}, runContext?: RunContext<SessionWithTracking  >) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        let commitAssociations: {
            sha: string;
            message: string;
            url: string;
            repository: string;
            branch: string;
        }[] = [];
        if (associatedCommits && associatedCommits.length > 0) {
            // Get commit context from the session
            const session = runContext?.context as SessionWithTracking;
            const commitContext = session?.commitContext;
            
            if (commitContext) {
                commitAssociations = associatedCommits.map(index => {
                    const commit = commitContext.commits[index];
                    if (!commit) {
                        console.warn(`Commit index ${index} not found in context`);
                        return null;
                    }
                    
                    return {
                        sha: commit.sha,
                        message: commit.name,
                        url: `https://github.com/${commitContext.repository.owner}/${commitContext.repository.name}/commit/${commit.sha}`,
                        repository: `${commitContext.repository.owner}/${commitContext.repository.name}`,
                        branch: commitContext.branch || 'main'
                    };
                }).filter((commit): commit is NonNullable<typeof commit> => commit !== null);
            }
        }

        runContext?.context.trackChange(EntityType.ACTION_EVENT, summary, ChangeEventType.CREATED);

        // format final summary
        const finalSummary = `
        ${summary}
        Associated commits: ${commitAssociations.map(commit => `[${commit.message}](${commit.url})`).join(', ')}
        Associated pull requests: ${associatedPullRequests?.join(', ')}
        `;

        runContext?.context.setFinalSummary(finalSummary);

        return {
            summary: summary,
            associatedCommits: commitAssociations,
            associatedPullRequests: associatedPullRequests,
        };
    }
});

export const createCommitSummaryTool = tool({
    name: 'Create Commit Summary',
    description: 'Create a summary of a commit',
    parameters: z.object({
        summary: z.string().describe('A summary of the commit'),
    }),
    execute: async ({summary}, runContext?: RunContext<SessionWithTracking  >) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        return {
            summary: summary,
        };
    }
});

export const actionEventTools = [createActionSummaryTool, createCommitSummaryTool];