import { ConfigInstance, ConfigType } from '../../shared/Configs';
import { SampleEvent } from '../../shared/SampleEvents';
import { GmailEvent } from '../GmailIntegration';
import { SlackEvent } from '../SlackIntegration';
import { JiraEvent } from '../AtlassianIntegration';
import { LinearEvent } from '../LinearIntegration';
import { GithubEvent } from '../GithubIntegration';
import { FigmaCommentEvent } from '../FigmaIntegration';
import { InputEvent } from './InputEvent';


interface InputEventClass {
    getSampleEvents(config: ConfigInstance, userId?: string): Promise<SampleEvent[]>;
    createInputEventFromSampleEvent(sampleEvent: SampleEvent): Promise<InputEvent>;
}

/**
 * Registry for input event handlers.
 * Maps ConfigType to event classes that implement sample event methods.
 */
export class InputEventRegistry {
    private static readonly EVENT_REGISTRY = new Map<ConfigType, InputEventClass>([
        [ConfigType.GMAIL, GmailEvent],
        [ConfigType.SLACK, SlackEvent],
        [ConfigType.JIRA, JiraEvent],
        [ConfigType.LINEAR_INPUT, LinearEvent],
        [ConfigType.GITHUB, GithubEvent],
        [ConfigType.FIGMA, FigmaCommentEvent]
    ]);

    static getEventHandler(configType: ConfigType): InputEventClass {
        const handler = this.EVENT_REGISTRY.get(configType);
        if (!handler) {
            throw new Error(`Unsupported integration type: ${configType}`);
        }
        return handler;
    }

    static hasEventHandler(configType: ConfigType): boolean {
        return this.EVENT_REGISTRY.has(configType);
    }

    static getSupportedConfigTypes(): ConfigType[] {
        return Array.from(this.EVENT_REGISTRY.keys());
    }
}
