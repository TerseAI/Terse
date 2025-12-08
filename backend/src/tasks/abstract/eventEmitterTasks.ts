import EventEmitter from 'node:events';
import { Task, TaskListener, TaskQueue, Unsubscribe } from './tasks';

export class EventEmitterTaskQueue<T extends Task> implements TaskQueue<T> {
    private emitter = new EventEmitter();

    addListener(listener: TaskListener<T>): Unsubscribe {
        this.emitter.on(listener.taskName, listener.onTask);
        return () => this.removeListener(listener);
    }

    removeListener(listener: TaskListener<T>): void {
        this.emitter.off(listener.taskName, listener.onTask);
    }

    emit(task: T): void {
        this.emitter.emit(task.taskName, task);
    }
}
