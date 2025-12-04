enum Tasks {
    CLASSIFY_DIRECTIVE = "CLASSIFY_DIRECTIVE"
}

interface TaskEmitter<T> {
    emit(task: Tasks, data: T): void;
}

interface TaskProcessor<T> {
    process(task: Tasks, data: T): void;
}




