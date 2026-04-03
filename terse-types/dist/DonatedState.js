export class DonatedState {
    toJSON() {
        const result = { stateType: this.stateType };
        for (const key of Object.keys(this)) {
            const value = this[key];
            if (typeof value !== "function") {
                result[key] = value;
            }
        }
        return result;
    }
}
