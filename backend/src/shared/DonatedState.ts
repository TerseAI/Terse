export abstract class DonatedState {
    abstract readonly stateType: string;

    toJSON(): Record<string, unknown> {
        const result: Record<string, unknown> = { stateType: this.stateType };
        for (const key of Object.keys(this)) {
            const value = (this as Record<string, unknown>)[key];
            if (typeof value !== 'function') {
                result[key] = value;
            }
        }
        return result;
    }
}
