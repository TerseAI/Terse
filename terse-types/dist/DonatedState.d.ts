export declare abstract class DonatedState {
    abstract readonly stateType: string;
    toJSON(): Record<string, unknown>;
}
