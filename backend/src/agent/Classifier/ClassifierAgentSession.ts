import { run } from "@openai/agents";
import { z } from "zod";
import { RunHistoryChatMemorySession } from "../CustomMemorySession";
import type { AgentOutputType, Session } from '@openai/agents-core/';
import { Agent } from "@openai/agents";

export type ResolvedAgentOutput<TSchema extends AgentOutputType> = TSchema extends z.ZodTypeAny ? z.infer<TSchema> : TSchema;

export type SessionFactory = (options: { sessionId: string; skipSave?: boolean }) => RunHistoryChatMemorySession;


export type AgentFactory<TSchema extends AgentOutputType> = () => Agent<Session, TSchema>;


export type RunFunction = typeof run;

export class ClassifierAgentSession<TRecord extends { id: string }, TSchema extends AgentOutputType> {
  private readonly sessionFactory: SessionFactory;
  private readonly agentFactory: AgentFactory<TSchema>;
  private readonly runFunction: RunFunction;
  private readonly defaultOutput?: ResolvedAgentOutput<TSchema>;

  constructor(
    sessionFactory: SessionFactory,
    agentFactory: AgentFactory<TSchema>,
    runFunction: RunFunction,
    defaultOutput?: ResolvedAgentOutput<TSchema>
  ) {
    this.sessionFactory = sessionFactory;
    this.agentFactory = agentFactory;
    this.runFunction = runFunction;
    this.defaultOutput = defaultOutput;
  }

  public async classify(record: TRecord, message: string): Promise<ResolvedAgentOutput<TSchema>> {
    const memorySession = this.sessionFactory({
      sessionId: record.id,
      skipSave: true // We don't want future agent sessions to remember this message
    });
    
    const classifierAgent = this.agentFactory();

    const result = await this.runFunction(classifierAgent, [{ role: 'user', content: message }], {
      session: memorySession,
    });

    // The finalOutput is already parsed according to the agent's outputType schema
    const output = result.finalOutput as ResolvedAgentOutput<TSchema> | undefined;

    if (output === undefined || output === null) {
      // If no output and a default is provided, return it
      if (this.defaultOutput !== undefined) {
        return this.defaultOutput;
      }
      throw new Error('Classification failed: no output received and no default provided');
    }
    
    return output;
  }
}

