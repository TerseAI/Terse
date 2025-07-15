import { RunContext, tool } from "@openai/agents";
import { ActivityOverview, SessionWithTracking, SubActivityOverview } from "../agents/Analyzer";
import { z } from "zod";

export const createActionSummaryTool = tool({
    name: 'Create Action Event',
    description: 'Create an action event',
    parameters: z.object({
        summary: z.string().describe('A top level summary of the event'),
        subActivitySummaries: z.array(
            z.object({
                summary: z.string().describe('A summary of the sub activity'),
                associatedCommits: z.array(z.number()).describe('The indices of commits to associate with this sub activity (0-based, from the event context)'),
                associatedPullRequests: z.array(z.object({
                    id: z.string().describe('The ID of the pull request'),
                    number: z.number().describe('The number of the pull request'),
                    title: z.string().describe('The title of the pull request'),
                    url: z.string().describe('The URL of the pull request'),
                })).describe('The pull requests to associate with this sub activity. OK to be empty if no pull requests are associated.'),
            })
        ).describe('A list of summaries for each sub activity'),
    }), 
    execute: async ({summary, subActivitySummaries}, runContext?: RunContext<SessionWithTracking  >) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }
        if (!runContext.context.commitContext) {
            console.warn("No commit context provided");
        }

        const topLevelSumary = summary;

        // go through each sub activity summary. Take the summary + Create an arrya of associated commits
        const subActivityOverviews: SubActivityOverview[] = [];
        for (const subActivitySummary of subActivitySummaries) {
            console.log("Creating sub activity summary associated commits", subActivitySummary.associatedCommits);
            const subActivityOverview: SubActivityOverview = {
                summary: subActivitySummary.summary,
                sub_activity_commit_associations: subActivitySummary.associatedCommits?.map(commitIndex => {
                    const commit = runContext.context.commitContext?.commits[commitIndex];
                    if (!commit) {
                        console.warn(`Commit index ${commitIndex} not found in context`);
                        return null;
                    }
                    return {
                        sha: commit.sha,
                        message: commit.name,
                        url: `https://github.com/${runContext.context.commitContext?.repository.owner}/${runContext.context.commitContext?.repository.name}/commit/${commit.sha}`,
                        repository: `${runContext.context.commitContext?.repository.owner}/${runContext.context.commitContext?.repository.name}`,
                        branch: runContext.context.commitContext?.branch || 'main',
                    }
                }).filter((commit): commit is NonNullable<typeof commit> => commit !== null) || [],
            };
            subActivityOverviews.push(subActivityOverview);
        }

        const overview: ActivityOverview = {
            summary: topLevelSumary,
            sub_activity_overviews: subActivityOverviews,
        };

        runContext?.context.setFinalSummary(overview);

        return overview;
    }
});

export const createCommitSummaryTool = tool({
    name: 'Create Commit Summary',
    description: 'Create a summary of a commit',
    parameters: z.object({
        summary: z.string().describe('A summary of the commit'),
    }),
    execute: async ({summary}, runContext?: RunContext<SessionWithTracking>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        console.log("Creating commit summary", summary);

        return {
            summary: summary,
        };
    }
});

export const actionEventTools = [createActionSummaryTool, createCommitSummaryTool];