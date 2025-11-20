import { FigmaInput } from "./FigmaInput";
import { GmailInput } from "./GmailInput";
import { Input } from "./Input";
import { SlackInput } from "./SlackInput";

export const INPUT_REGISTRY: Input<any>[] = [
    new GmailInput(),
    new SlackInput(),
    new FigmaInput()
];