import { makeTheme } from '@inquirer/core';
const theme = makeTheme();
const prefix = typeof theme.prefix === 'string' ? theme.prefix : theme.prefix.idle;
const SkippedRenderer = {
    confirm: (question) => {
        const defaultVal = question.default;
        const answerText = defaultVal === true ? 'Yes' : defaultVal === false ? 'No' : '';
        return renderLine(question.message.toString(), answerText);
    },
    select: (question) => {
        const defaultVal = question.default;
        let answerText = String(defaultVal);
        if (question.choices && defaultVal !== undefined) {
            const selectedChoice = question.choices.find((c) => c.value === defaultVal);
            answerText = selectedChoice ? selectedChoice.name : String(defaultVal);
        }
        return renderLine(question.message.toString(), answerText);
    },
    checkbox: (question) => {
        const defaultVal = question.default;
        let answerText = '';
        if (Array.isArray(defaultVal) && question.choices) {
            const selectedNames = question.choices
                .filter((c) => defaultVal.includes(c.value))
                .map((c) => c.name);
            answerText = selectedNames.join(', ');
        }
        else if (defaultVal !== undefined) {
            answerText = String(defaultVal);
        }
        return renderLine(question.message.toString(), answerText);
    },
    editor: (question) => {
        const answerText = question.default !== undefined ? '[Default Content]' : '';
        return renderLine(question.message.toString(), answerText);
    },
    password: (question) => {
        const defaultVal = question.default;
        let answerText = '';
        if (defaultVal !== undefined) {
            answerText = '[PASSWORD SET]';
        }
        return renderLine(question.message.toString(), answerText);
    },
    default: (question) => {
        const answerText = question.default !== undefined ? String(question.default) : '';
        return renderLine(question.message.toString(), answerText);
    },
    list: (question) => SkippedRenderer.select(question),
    rawlist: (question) => SkippedRenderer.select(question),
    input: (question) => SkippedRenderer.default(question),
    number: (question) => SkippedRenderer.default(question),
};
function renderLine(message, answerText) {
    return theme.style.help(`${prefix} ${message} ${answerText}`);
}
export default SkippedRenderer;
