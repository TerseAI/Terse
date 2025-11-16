import chalk from 'chalk';
import { db } from '../../prismaClient';
import { Automation, AutomationVersionWithRelations, AutomationOutput, User } from '../../types/prisma';
import { InputEvent } from '../../Updater/InputEvents';
import { OutputFactory } from '../../Updater/Outputs/OutputFactory';
import { AutomationAgent } from './AutomationAgent';
import { filterEvent } from './EventFilter';
import { appendRunAction, createRunRecord, finalizeRunStatus, markRunFailed, markRunProcessed, markRunSkipped, FailureStage } from './runHistory';
import { ApprovalResult } from './AutomationAgent';
import { Agent, AgentOutputType, RunResult } from '@openai/agents';
import { Session } from '../../server';
import { emitCacheInvalidationWithWildcard } from '../../realtimeSocket';
import { RunHistoryAction } from '../../shared/RunHistoryTypes';

// The job of this class is to take an Input Event, and check if it's a match for an Automation.
// It will then create a Session, and summon the Automation Agent with the create user data.

export class ProcessorResult<T extends Session = Session> {
    success: boolean;
    message: string;
    automation: Automation | null;
    approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null;

    constructor(success: boolean, message: string, automation: Automation | null, approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null) {
        this.success = success;
        this.message = message;
        this.automation = automation;
        this.approvalResult = approvalResult;
    }
}

export class EventProcessor {
    private inputEvent: InputEvent;
    private user: User;

    constructor(inputEvent: InputEvent, user: User) {
        this.inputEvent = inputEvent;
        this.user = user;
    }

    async process(): Promise<ProcessorResult[]> {
        console.log(chalk.gray(`Processing input event: ${this.inputEvent.debugLog()}`));

        const results: ProcessorResult[] = [];

        // Get integration type from event itself (no hardcoded checks)
        const integrationType = this.inputEvent.integrationType;

        // Find all active PRODUCTION automation versions for this user (already includes all config relations)
        // CRITICAL: Only process production versions that are active - never process drafts
        const automationVersions = await db().automation_versions.findMany({
            where: {
                status: 'PRODUCTION',
                is_active: true,
                automation: {
                    user_id: this.user.id,
                },
            },
            include: {
                automation: true, // Include the container to get the name
                prompt: true,
                inputs: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        linear_config: true,
                        jira_config: true,
                        confluence_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                },
                output: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        notion_page_config: true,
                        linear_config: true,
                        jira_config: true,
                        confluence_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                }
            }
        }) as AutomationVersionWithRelations[];

        if (automationVersions.length === 0) {
            return [new ProcessorResult(false, "No active production automations found for this user", null)];
        }

        // Filter automation versions using event's own filtering method
        // Each event type handles its own matching logic (no switch statements)
        const matchingAutomations = automationVersions.filter(version =>
            version.inputs.some(input => this.inputEvent.matchesAutomationInput(input))
        );

        if (matchingAutomations.length === 0) {
            return [new ProcessorResult(false, `No automations match this ${integrationType} event`, null)];
        }

        console.log(chalk.cyan(`Found ${matchingAutomations.length} matching automation(s) for ${integrationType} event`));

        // Process each matching automation version
        for (const version of matchingAutomations) {
            try {
                const result = await this.processAutomation(version);
                results.push(result);
            } catch (error) {
                console.error(chalk.red(`Error processing automation ${version.automation.name} (version ${version.id}):`), error);
                // Use the automation container for the result (already fetched in the query)
                results.push(new ProcessorResult(
                    false,
                    `Error processing automation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    version.automation
                ));
            }
        }

        return results;
    }

    private async processAutomation(version: AutomationVersionWithRelations): Promise<ProcessorResult> {
        const automationName = version.automation.name;
        const automationContainerId = version.automation_id;
        const automationContainer = version.automation; // Already fetched in the query
        console.log(chalk.cyan(`Processing automation: ${automationName} (version ${version.id}, container ${automationContainerId})`));

        if (!version.prompt) {
            return new ProcessorResult(false, "No prompt found for this automation", automationContainer);
        }

        // Initialize run history record with trigger details
        // Use automation_version_id for the run history record
        const trigger = this.inputEvent.createTriggerMetadata();
        const runId = await createRunRecord({
            automationVersionId: version.id,
            trigger,
        });
        // Use automation container ID for cache invalidation (frontend queries by container ID)
        emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', automationContainerId);

        // Get the output from automation version relations (already fetched with config)
        const outputIntegration = version.output;

        if (!outputIntegration) {
            return new ProcessorResult(false, "No output integration found for this automation", automationContainer);
        }

        // Use OutputFactory to create output based on integration type (no hardcoded Notion logic)
        const output = OutputFactory.createOutput(outputIntegration.integration_type);
        if (!output) {
            return new ProcessorResult(false, `Output type ${outputIntegration.integration_type} is not supported`, automationContainer);
        }

        // Use output's config-aware session creation (no hardcoded config extraction)
        // Each output type knows how to fetch its own integration and extract its config
        let session: Session;
        try {
            session = await output.createSessionFromConfig(
                outputIntegration.integration_id,
                outputIntegration,
                this.user
            );
        } catch (error) {
            return new ProcessorResult(
                false,
                `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
                automationContainer
            );
        }

        // Filter the event using AI to see if it's relevant to this automation
        let filterResult;
        try {
            filterResult = await filterEvent<Session>(
                this.inputEvent,
                version.prompt,
                session
            );
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red(`Error filtering event for automation "${automationName}":`), error);
            
            try {
                await markRunFailed(runId, errorMessage, 'filter');
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', automationContainerId);
            } catch (e) {
                console.error(chalk.yellow('Failed to mark run as failed'), e);
            }
            
            return new ProcessorResult(
                false,
                `Error during filtering: ${errorMessage}`,
                automationContainer
            );
        }

        if (!filterResult.isRelevant) {
            console.log(chalk.gray(`Event is not relevant to automation "${automationName}": ${filterResult.reason}`));
            try {
                await markRunSkipped(runId, filterResult.reason);
            } catch (e) {
                console.error(chalk.yellow('Failed to mark run skipped'), e);
            }
            return new ProcessorResult(false, `Not relevant: ${filterResult.reason}`, automationContainer);
        }

        try {
            await markRunProcessed(runId, filterResult.reason);
        } catch (e) {
            console.error(chalk.yellow('Failed to mark run processed'), e);
        }

        console.log(chalk.green(`Event is relevant to automation "${automationName}"`));

        // Create automation agent with the session and output
        const automationAgent = new AutomationAgent(session, output, version.prompt, version.inputs, outputIntegration);
        await automationAgent.initializeAgent();
        automationAgent.setInputEvent(this.inputEvent);

        // Run the automation agent
        let result: ApprovalResult<Session, Agent<Session, AgentOutputType>>;
        try {
            result = await automationAgent.run() as ApprovalResult<Session, Agent<Session, AgentOutputType>>;
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red(`Error running automation agent for "${automationName}":`), error);
            
            try {
                await markRunFailed(runId, errorMessage, 'agent');
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', automationContainerId);
            } catch (e) {
                console.error(chalk.yellow('Failed to mark run as failed'), e);
            }
            
            // Re-throw to be caught by outer try-catch
            throw error;
        }

        if (result.status === 'completed') {
            console.log(chalk.green(`Automation "${automationName}" completed:`), result.result.finalOutput);
            return persistRunResult(runId, result.result, session, automationContainer, result);
        } else {
            console.log(chalk.yellow(`Automation "${automationName}" awaiting approval:`));
            return new ProcessorResult(false, "Automation awaiting approval", automationContainer, result);
        }
    }
}

async function persistRunResult<T extends Session>(
    runId: string,
    result: RunResult<T, Agent<T, AgentOutputType>>,
    session: T,
    automation: Automation,
    approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null
): Promise<ProcessorResult<T>> {
    // Check if session has runActions (NotionSession and future session types may have this)
    if (session.runActions) {
        for (const action of session.runActions) {
            try {
                await appendRunAction(runId, action);
                // Invalidate all run history queries for this automation, regardless of params
                // The frontend will match on tag='runHistory' and id=automationId
                emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', automation.id);
            } catch (e) {
                console.error(chalk.yellow('Failed to append run action'), e);
            }
        };
    }

    // Finalize run status
    const hasFinalOutput = Boolean(result.finalOutput);
    try {
        await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
        // Invalidate all run history queries for this automation when status changes
        emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', automation.id);
    } catch (e) {
        console.error(chalk.yellow('Failed to finalize run status'), e);
    }

    const finalOutput = typeof result.finalOutput === 'string' ? result.finalOutput : '';
    return new ProcessorResult<T>(
        hasFinalOutput,
        finalOutput,
        automation,
        approvalResult
    );
}