import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { RunHistoryRecord } from "../../shared/RunHistoryTypes";
import { RunHistoryChatMemorySession } from "../CustomMemorySession";
import type { Session } from '@openai/agents-core/';
import {
  ClassifierAgentSession,
  type AgentFactory,
  type SessionFactory,
  type RunFunction,
} from "../Classifier/ClassifierAgentSession";


const DirectiveClassification = z.object({
  isDirective: z.boolean(),
  directiveDescription: z.string()
});

type DirectiveClassificationType = z.infer<typeof DirectiveClassification>

interface DirectiveAgentRecord {
  id: string;
}

class DirectiveAgentSession<T extends DirectiveAgentRecord> extends ClassifierAgentSession<T, typeof DirectiveClassification> {
  constructor(
    sessionFactory: SessionFactory,
    agentFactory: AgentFactory<typeof DirectiveClassification>,
    runFunction: RunFunction
  ) {
    super(
      sessionFactory,
      agentFactory,
      runFunction,
      { isDirective: false, directiveDescription: '' } // Default output for directives
    );
  }
}

function createDefaultDirectiveAgentFactory(): AgentFactory<typeof DirectiveClassification> {
  return () => new Agent<Session, typeof DirectiveClassification>({
    name: "Directive Classifier Agent",
    instructions: `You are a classifier that decides whether the **latest user message** is a DIRECTIVE to the Terse AI system.
        ### Definition

        A *directive* is:

        - A message that expresses a **rule, preference, or policy** for how Terse AI should behave **from now on or in general**, not just for a single request.
        - It typically changes how future messages should be handled, or sets a standing preference.

        A directive is **not**:

        - A one-off task, request, or question that only applies **right now**.
        - A request to perform a concrete action once.

        ### Examples

        **Directives (isDirective = true)**

        - "Always summarize tickets before creating them."
        - "Use a more formal tone in responses from now on."
        - "Don't create tickets automatically."
        - "Whenever someone tags me, create a Jira ticket."
        - "In this channel, only notify me about high-priority issues."

        **Non-directives (isDirective = false)**

        - "What's the status of ticket ABC-123?"
        - "Create a ticket for this bug."
        - "Show me recent activity."
        - "Can you draft a reply to this email?"
        - "Please create a Jira ticket with the following details."

        **Borderline examples**

        - "Stop creating tickets for every message" → directive (changes ongoing behavior)
        - "Don't create a ticket for this one" → non-directive (one-off)
        - "I'd prefer if you didn't create tickets automatically" → directive (preference about future behavior)

        ### Classification Rules

        1. Mark **isDirective = true** if the message:
          - Describes how Terse AI should behave **in general** or **from now on**, OR
          - Changes settings, preferences, or policies for future behavior, even if phrased politely.

        2. Mark **isDirective = false** if the message:
          - Is only about a single action or request right now, OR
          - Is just a question or a request for information.

        3. If you are uncertain, **err on the side of isDirective = false**.

        ### Output format

        Return a JSON object with:

        - \`isDirective\`: boolean  
        - \`directiveDescription\`: 
          - If \`isDirective = true\`: a **short, imperative summary** of the directive (e.g. "Only create tickets for high-priority issues").
          - If \`isDirective = false\`: an **empty string**.

        Do not include explanations or any extra fields. Only output the JSON object.`,
    model: "gpt-5-nano",
    modelSettings: {
      temperature: 0,
    },
    outputType: DirectiveClassification,
  });
}

function createDefaultSessionFactory(): SessionFactory {
  return (options) => new RunHistoryChatMemorySession(options);
}

async function classifyDirective(runHistory: RunHistoryRecord, message: string): Promise<DirectiveClassificationType> {
  const sessionFactory = createDefaultSessionFactory();
  const agentFactory = createDefaultDirectiveAgentFactory();
  
  const directiveAgentSession = new DirectiveAgentSession(
    sessionFactory,
    agentFactory,
    run
  );

  return directiveAgentSession.classify(runHistory, message);
}

export { 
  DirectiveAgentSession, 
  createDefaultDirectiveAgentFactory, 
  createDefaultSessionFactory, 
  classifyDirective
};
