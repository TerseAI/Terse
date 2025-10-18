import { RunContext, Tool, tool } from "@openai/agents";
import { ActivityOverview, SessionWithTracking, SubActivityOverview } from "../agents/Analyzer";
import { z } from "zod";

export const createActionSummaryTool: Tool<SessionWithTracking> = tool({
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
        associatedProjectDescription: z.string().describe('The description of the project to associate with this event. OK to be empty if no project is associated.'),
        associatedTicketDescription: z.string().describe('The description of the ticket to associate with this event. OK to be empty if no ticket is associated.'),
    }), 
    execute: async ({summary, subActivitySummaries, associatedProjectDescription, associatedTicketDescription}, runContext?: RunContext<SessionWithTracking  >) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }
        if (!runContext.context.commitContext) {
            console.warn("No commit context provided");
        }

        const topLevelSumary = summary;

        // go through each sub activity summary. Take the summary + Create an array of associated commits
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
            project_activity_events: (associatedProjectDescription && runContext.context.commitContext?.project) ? [{
                project: runContext.context.commitContext?.project || undefined,
                event_type: 'project_activity_event',
                title: associatedProjectDescription
            }] : [],
            ticket_activity_events: (associatedTicketDescription && runContext.context.commitContext?.ticket) ? [{
                ticket: runContext.context.commitContext.ticket,
                event_type: 'ticket_activity_event',
                title: associatedTicketDescription
            }] : [],
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