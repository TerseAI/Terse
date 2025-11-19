import { GmailInput } from "./GmailInput";
import { Input } from "./Input";
import { Integration } from "../integrations/abstract/Integration";

export const INPUT_REGISTRY: Input<any>[] = [
    new GmailInput(),
];