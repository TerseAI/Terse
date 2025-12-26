import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { PosthogConfig } from "../../../shared/Configs";
import { settings } from "../../../config/settings";
import { analyzeSession, AnalyzeSessionOptions } from "./sessionAnalysis";

/**
 * Tool for analyzing PostHog session recordings using the Session Analysis API.
 * This tool uses an external service to convert session recordings to MP4 and analyze them with AI
 * to provide a comprehensive bug report and analysis.
 */
export const analyzeSessionTool = tool({
    name: 'analyzePosthogSession',
    description: 'Analyze a PostHog session recording using the Session Analysis API. This tool converts the session to video and analyzes it with AI to generate a comprehensive bug report and analysis. Use this when you need to investigate user issues, bugs, or understand what happened during a user session. By default, analyzes the most recent session for a user. Can also analyze a specific session by ID. Requires a description of the issue the user reported to focus the analysis.',
    parameters: z.object({
        userEmail: z.string().email().optional().describe('The email address of the user to analyze a session for. If provided without sessionId, analyzes the most recent session for this user.'),
        sessionId: z.string().uuid().optional().describe('The PostHog session ID (UUID format) to analyze. If provided, this takes precedence over userEmail.'),
        userIssueDescription: z.string().describe('Required: A clear description of the issue the user reported. This helps the AI focus its analysis on the specific problem. Be specific about what the user was trying to do, what went wrong, any error messages, and when/where in the flow the issue occurred. Examples: "User reports that clicking the submit button does nothing - no error message, no network request", "User says the page loads very slowly - takes over 30 seconds", "User reports a JavaScript error appears in the console when trying to complete checkout".'),
    }),
    execute: async ({ userEmail, sessionId, userIssueDescription }, runContext?: RunContext<any>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        // Get PostHog config from context - must be set by the knowledge base session
        const posthogConfig = runContext.context.posthogConfig as PosthogConfig | undefined;
        if (!posthogConfig) {
            throw new Error("PostHog config not found in context. Ensure PostHog is configured as a knowledge base.");
        }

        if (!posthogConfig.canReadSessionRecordings) {
            throw new Error("PostHog session recordings access is not enabled for this knowledge base.");
        }

        // Validate that at least one parameter is provided (this validation is done in the tool logic)
        if (!userEmail && !sessionId) {
            throw new Error("Either userEmail or sessionId must be provided. At least one parameter is required.");
        }

        // Validate required userIssueDescription
        if (!userIssueDescription || userIssueDescription.trim() === '') {
            throw new Error("userIssueDescription is required and cannot be empty. Please provide a clear description of the issue the user reported.");
        }

        // Get Session Analysis API settings
        const sessionAnalysisApiKey = settings.posthogSessionAnalysis.apiKey;
        const sessionAnalysisBaseUrl = settings.posthogSessionAnalysis.baseUrl;
        if (!sessionAnalysisApiKey) {
            throw new Error("POSTHOG_SESSION_ANALYSIS_API_KEY is not configured. Please set the POSTHOG_SESSION_ANALYSIS_API_KEY environment variable.");
        }
        if (!sessionAnalysisBaseUrl) {
            throw new Error("POSTHOG_SESSION_ANALYSIS_BASE_URL is not configured. Please set the POSTHOG_SESSION_ANALYSIS_BASE_URL environment variable.");
        }

        // Get PostHog integration
        const integration = await db().posthog_integrations.findUnique({
            where: { id: posthogConfig.integrationId },
        });

        if (!integration) {
            throw new Error(`PostHog integration not found: ${posthogConfig.integrationId}`);
        }

        const posthogApiKey = integration.api_key;
        const projectId = posthogConfig.projectId;
        const posthogHost = 'https://us.posthog.com';

        try {
            logger.info('Analyzing PostHog session', { 
                userEmail, 
                sessionId, 
                projectId,
                integrationId: posthogConfig.integrationId 
            });

            // Prepare options for analyzeSession
            const options: AnalyzeSessionOptions = {
                posthogApiKey,
                projectId,
                sessionAnalysisApiKey,
                sessionAnalysisBaseUrl,
                userIssueDescription: userIssueDescription.trim(),
                posthogHost,
                sessionId,
                userEmail,
            };

            // Call the analysis function
            const result = await analyzeSession(options);

            logger.info('PostHog session analysis complete', {
                sessionId: result.session.id,
                sessionUrl: result.sessionUrl,
            });

            return {
                success: true,
                sessionId: result.session.id,
                sessionUrl: result.sessionUrl,
                analysis: result.analysis,
                sessionInfo: {
                    duration: result.session.duration,
                    eventsCount: result.session.eventsCount,
                    startTime: result.session.startTime,
                    endTime: result.session.endTime,
                },
                message: `Session analysis complete. Session: ${result.session.id}. View session: ${result.sessionUrl}`,
            };
        } catch (error: any) {
            logger.error('Error analyzing PostHog session', { 
                error, 
                userEmail, 
                sessionId, 
                projectId 
            });
            
            // Provide more specific error messages
            if (error.message?.includes('not found')) {
                throw new Error(`Session not found: ${error.message}`);
            } else if (error.message?.includes('API key')) {
                throw new Error(`API key error: ${error.message}`);
            } else if (error.message?.includes('No session found')) {
                throw new Error(`No session found for ${userEmail || sessionId}. The user may not have any recorded sessions yet.`);
            }
            
            throw new Error(`Failed to analyze PostHog session: ${error.message || 'Unknown error'}`);
        }
    },
});

