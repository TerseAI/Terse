import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { db } from "../../../prismaClient";
import { PosthogConfig } from "../../../shared/Configs";
import { settings } from "../../../config/settings";
import { analyzeSession, AnalyzeSessionOptions } from "./sessionAnalysis";

/**
 * Tool for analyzing PostHog session recordings with Gemini AI.
 * This tool exports the session as MP4, fetches console logs, and analyzes everything with Gemini
 * to provide a comprehensive bug report and analysis.
 */
export const analyzeSessionTool = tool({
    name: 'analyzePosthogSession',
    description: 'Analyze a PostHog session recording with Gemini AI. This tool exports the session video, fetches console logs, and generates a comprehensive bug report and analysis. Use this when you need to investigate user issues, bugs, or understand what happened during a user session. By default, analyzes the most recent session for a user. Can also analyze a specific session by ID.',
    parameters: z.object({
        userEmail: z.string().email().optional().describe('The email address of the user to analyze a session for. If provided without sessionId, analyzes the most recent session for this user.'),
        sessionId: z.string().uuid().optional().describe('The PostHog session ID (UUID format) to analyze. If provided, this takes precedence over userEmail.'),
    }),
    execute: async ({ userEmail, sessionId }, runContext?: RunContext<any>) => {
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

        // Get Google API key from settings
        const googleApiKey = settings.google.apiKey;
        if (!googleApiKey) {
            throw new Error("GOOGLE_API_KEY is not configured. Please set the GOOGLE_API_KEY environment variable.");
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
                googleApiKey,
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

