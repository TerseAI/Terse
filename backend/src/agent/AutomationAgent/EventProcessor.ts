import chalk from 'chalk';
import { db } from '../../prismaClient';
import { Automation, AutomationWithRelations, AutomationOutput, User } from '../../types/prisma';
import { InputEvent } from '../../Updater/InputEvents';
import { OutputFactory } from '../../Updater/Outputs/OutputFactory';
import { AutomationAgent } from './AutomationAgent';
import { filterEvent } from './EventFilter';
import { appendRunAction, createRunRecord, finalizeRunStatus, markRunProcessed, markRunSkipped } from './runHistory';
import { ApprovalResult } from './AutomationAgent';
import { Agent, AgentOutputType, RunResult } from '@openai/agents';
import { Session } from '../../server';
import { emitCacheInvalidationWithWildcard } from '../../realtimeSocket';

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

        // Find all active automations for this user (already includes all config relations)
        const automations = await db().automations.findMany({
            where: {
                user_id: this.user.id,
                is_active: true,
            },
            include: {
                prompt: true,
                inputs: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        linear_config: true,
                        jira_config: true,
                        github_config: true,
                        gmail_config: true,
                        figma_config: true,
                    }
                },
                output: {
                    include: {
                        slack_config: true,
                        notion_config: true,
                        linear_config: true,
                        jira_config: true,
                        github_config: true,
                        gmail_config: true,
                    }
                }
            }
        }) as AutomationWithRelations[];

        if (automations.length === 0) {
            return [new ProcessorResult(false, "No automations found for this user", null)];
        }

        // Filter automations using event's own filtering method
        // Each event type handles its own matching logic (no switch statements)
        const matchingAutomations = automations.filter(automation =>
            automation.inputs.some(input => this.inputEvent.matchesAutomationInput(input))
        );

        if (matchingAutomations.length === 0) {
            return [new ProcessorResult(false, `No automations match this ${integrationType} event`, null)];
        }

        console.log(chalk.cyan(`Found ${matchingAutomations.length} matching automation(s) for ${integrationType} event`));

        // Process each matching automation
        for (const automation of matchingAutomations) {
            try {
                const result = await this.processAutomation(automation);
                results.push(result);
            } catch (error) {
                console.error(chalk.red(`Error processing automation ${automation.id}:`), error);
                results.push(new ProcessorResult(
                    false,
                    `Error processing automation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    automation
                ));
            }
        }

        return results;
    }

    private async processAutomation(automation: AutomationWithRelations): Promise<ProcessorResult> {
        console.log(chalk.cyan(`Processing automation: ${automation.name} (${automation.id})`));

        if (!automation.prompt) {
            return new ProcessorResult(false, "No prompt found for this automation", automation);
        }

        // Initialize run history record with trigger details
        // Use event's own trigger metadata creation (no hardcoded trigger creation)
        let runId: string | null = null;
        try {
            const trigger = this.inputEvent.createTriggerMetadata();
            runId = await createRunRecord({
                automationId: automation.id,
                trigger,
            });
        } catch (e) {
            console.error(chalk.yellow('Failed to create run history record'), e);
        }

        // Filter the event using AI to see if it's relevant to this automation
        const filterResult = await filterEvent(this.inputEvent, automation.prompt);
        if (!filterResult.isRelevant) {
            console.log(chalk.gray(`Event is not relevant to automation "${automation.name}": ${filterResult.reason}`));
            if (runId) {
                try {
                    await markRunSkipped(runId, filterResult.reason);
                } catch (e) {
                    console.error(chalk.yellow('Failed to mark run skipped'), e);
                }
            }
            return new ProcessorResult(false, `Not relevant: ${filterResult.reason}`, automation);
        }

        if (runId) {
            try {
                await markRunProcessed(runId, filterResult.reason);
            } catch (e) {
                console.error(chalk.yellow('Failed to mark run processed'), e);
            }
        }

        console.log(chalk.green(`Event is relevant to automation "${automation.name}"`));

        // Get the output from automation relations (already fetched with config)
        const outputIntegration = automation.output;

        if (!outputIntegration) {
            return new ProcessorResult(false, "No output integration found for this automation", automation);
        }

        // Use OutputFactory to create output based on integration type (no hardcoded Notion logic)
        const output = OutputFactory.createOutput(outputIntegration.integration_type);
        if (!output) {
            return new ProcessorResult(false, `Output type ${outputIntegration.integration_type} is not supported`, automation);
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
                automation
            );
        }

        // Create automation agent with the session and output
        const automationAgent = new AutomationAgent(session, output, automation.prompt, automation.inputs, outputIntegration);
        await automationAgent.initializeAgent();
        automationAgent.setInputEvent(this.inputEvent);

        // Run the automation agent
        // Type assertion needed because TypeScript can't narrow the generic type at runtime
        const result = await automationAgent.run() as ApprovalResult<Session, Agent<Session, AgentOutputType>>;
        
        if (result.status === 'completed') {
            console.log(chalk.green(`Automation "${automation.name}" completed:`), result.result.finalOutput);
            return persistRunResult(runId, result.result, session, automation, result);
        } else {
            console.log(chalk.yellow(`Automation "${automation.name}" awaiting approval:`));
            return new ProcessorResult(false, "Automation awaiting approval", automation, result);
        }
    }
}

async function persistRunResult<T extends Session>(
    runId: string | null, 
    result: RunResult<T, Agent<T, AgentOutputType>>, 
    session: T, 
    automation: Automation, 
    approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null
): Promise<ProcessorResult<T>> {
    // Check if session has runActions (NotionSession and future session types may have this)
    if (runId && (session as any).runActions && Array.isArray((session as any).runActions) && (session as any).runActions.length > 0) {
        for (const action of (session as any).runActions) {
            try {
                await appendRunAction(runId, action);
                // Invalidate all run history queries for this automation, regardless of params
                // The frontend will match on tag='runHistory' and id=automationId
                emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', automation.id);
            } catch (e) {
                console.error(chalk.yellow('Failed to append run action'), e);
            }
        }
    }

    // Finalize run status
    if (runId) {
        try {
            await finalizeRunStatus(runId, result.finalOutput ? 'success' : 'failed');
            // Invalidate all run history queries for this automation when status changes
            emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', automation.id);
        } catch (e) {
            console.error(chalk.yellow('Failed to finalize run status'), e);
        }
    }

    return new ProcessorResult<T>(
        result.finalOutput ? true : false,
        result.finalOutput as string,
        automation,
        approvalResult
    );
}