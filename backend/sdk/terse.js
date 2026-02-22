import { GitHubConfig as GitHubConfigInternal, TimeTriggerConfig as TimeTrigger } from "../src/shared/Configs";
class Terse {
    constructor() {
        // fetch api_key from env
    }
    createJob(params) {
        // Deploy the job, run code in Modal Sandbox etc...
        // This is most of the work tbh
    }
}
// A good chunk of work here too. I am hoping it's a simpler version of AgentRunner
class TerseAgent {
    prompt;
    toolBox;
    constructor(prompt, toolBox) {
        this.prompt = prompt;
        this.toolBox = toolBox;
    }
    async *run(prompt, event) {
        yield new TextResult("Hello, world!");
        return;
    }
}
var EventType;
(function (EventType) {
    EventType["TEXT"] = "text";
    EventType["TOOL_CALL_PARAMS"] = "tool_call_params";
    EventType["TOOL_CALL_STARTED"] = "tool_call_started";
    EventType["TOOL_CALL_COMPLETED"] = "tool_call_completed";
    EventType["ACTION"] = "action";
})(EventType || (EventType = {}));
class TextResult {
    type;
    text;
    constructor(text) {
        this.type = EventType.TEXT;
        this.text = text;
    }
}
class ToolCallParamsResult {
    type;
    toolCallParams;
    constructor(toolCallParams) {
        this.type = EventType.TOOL_CALL_PARAMS;
        this.toolCallParams = toolCallParams;
    }
}
class ToolCallStartedResult {
    type;
    toolCallStarted;
    constructor(toolCallStarted) {
        this.type = EventType.TOOL_CALL_STARTED;
        this.toolCallStarted = toolCallStarted;
    }
}
class ToolCallCompletedResult {
    type;
    toolCallCompleted;
    constructor(toolCallCompleted) {
        this.type = EventType.TOOL_CALL_COMPLETED;
        this.toolCallCompleted = toolCallCompleted;
    }
}
class ActionResult {
    type;
    action;
    constructor(action) {
        this.type = EventType.ACTION;
        this.action = action;
    }
}
/**
 * CODE GENERATION CODE: This is user specific!!!
 */
class GithubRepositories {
    repositoryId;
    constructor(repositoryId) {
        this.repositoryId = repositoryId;
    }
    // This is Code-Gened Pre-Compiled step
    static TerseAI = new GithubRepositories(10030021);
    static LandingPage = new GithubRepositories(10030022);
}
class GithubSkill extends GitHubConfigInternal {
    constructor(repositories) {
        const repositoryIds = repositories.map(r => r.repositoryId);
        // Github token is
        super("github_token", repositoryIds);
    }
}
/**
 * CLIENT CODE: What the user will write
 */
const client = new Terse();
// This closure will be run according to the trigger configuration in a sandboxed environment.
const ReleaseNotesJob = client.createJob({
    name: "Release Notes Job",
    triggers: [new TimeTrigger("0 0 * * *")],
    skills: [new GithubSkill([GithubRepositories.TerseAI, GithubRepositories.LandingPage])],
    onTrigger: async (event, Agent) => {
        const prompt = "You are a helpful assistant that can help with the release notes";
        // Run any code here. Can use the toolbox, and our TerseAgent, or they can do whatever they want.
        const terseAgent = Agent.run(prompt, event);
    },
    webhookURL: "https://example.com/webhook"
});
/**
 * From here, we can test, deploy debug with either CLI and trigger with GithubActions. We can still expose these in WebUI to analyze runs and stuff.
 */
//# sourceMappingURL=terse.js.map