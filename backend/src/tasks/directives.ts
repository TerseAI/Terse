import { EventEmitterTaskQueue } from "./abstract/eventEmitterTasks";
import { Task } from "./abstract/tasks";

export class DirectiveTask implements Task {
    taskName: string;
    runId: string;
    message: string;
    constructor(taskName: string, runId: string, message: string) {
        this.taskName = taskName;
        this.runId = runId;
        this.message = message;
    }
}

class DirectiveTaskQueue extends EventEmitterTaskQueue<DirectiveTask> {}

export const directiveTaskQueue = new DirectiveTaskQueue();

directiveTaskQueue.addListener({
    taskName: "DIRECTIVE_TASK",
    onTask: async (task: DirectiveTask) => {
        console.log(`Directive task received: ${task.message}`);
    }
});
