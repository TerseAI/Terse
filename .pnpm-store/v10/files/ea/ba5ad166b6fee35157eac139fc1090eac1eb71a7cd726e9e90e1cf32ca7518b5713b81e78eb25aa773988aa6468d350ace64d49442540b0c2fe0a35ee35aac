import { Answers, Question } from '../types.ts';
type RendererFunction<A extends Answers = Answers> = (question: Question<A>) => string;
type SkippedRendererType<A extends Answers = Answers> = {
    [key: string]: RendererFunction<A>;
    confirm: RendererFunction<A>;
    select: RendererFunction<A>;
    checkbox: RendererFunction<A>;
    editor: RendererFunction<A>;
    password: RendererFunction<A>;
    default: RendererFunction<A>;
};
declare const SkippedRenderer: SkippedRendererType;
export default SkippedRenderer;
