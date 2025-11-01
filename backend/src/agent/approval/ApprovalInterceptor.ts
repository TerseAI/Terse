import { Agent, AgentInputItem, run, AgentOutputType, RunResult, RunState, RunToolApprovalItem } from '@openai/agents';
import { Session } from '../../server';

/**
 * Result from approval-aware execution.
 * Discriminated union: either completed or awaiting approval.
 */
export type ApprovalResult<T extends Session, AgentType extends Agent<T, AgentOutputType>> =
  | {
    status: 'completed';
    result: RunResult<T, AgentType>;
  }
  | {
    status: 'awaiting_approval';
    state: RunState<T, AgentType>;
    interruptions: RunToolApprovalItem[];
  };

export type Decision = 'approve' | 'reject';

/**
 * ApprovalInterceptor wraps the OpenAI Agents SDK run() function to detect
 * and handle approval interruptions.
 */
export class ApprovalInterceptor {
  static async run<T extends Session, AgentType extends Agent<T, AgentOutputType>>(
    agent: AgentType,
    history: AgentInputItem[],
    context: T,
  ): Promise<ApprovalResult<T, AgentType>> {
    const result = await run(agent, history, {
      context,
    });

    const hasInterruptions = result.interruptions && result.interruptions.length > 0;

    if (hasInterruptions) {
      return {
        status: 'awaiting_approval',
        state: result.state,
        interruptions: result.interruptions,
      };
    }

    return {
      status: 'completed',
      result,
    };
  }

  static async resume<T extends Session, AgentType extends Agent<T, AgentOutputType>>(
    agent: AgentType,
    serializedState: string,
    decision: Decision,
    interruption: RunToolApprovalItem,
  ): Promise<ApprovalResult<T, AgentType>> {
    // Deserialize the saved state
    const state: RunState<T, AgentType> = await RunState.fromString(agent, serializedState);

    // Apply the user's decision  
    if (decision === 'approve') {
      state.approve(interruption);
    } else {
      state.reject(interruption);
    }

    // Resume execution
    const result = await run(agent, state);

    const hasInterruptions = result.interruptions && result.interruptions.length > 0;

    if (hasInterruptions) {
      return {
        status: 'awaiting_approval',
        state: result.state,
        interruptions: result.interruptions,
      };
    }

    return {
      status: 'completed',
      result,
    };
  }
}
