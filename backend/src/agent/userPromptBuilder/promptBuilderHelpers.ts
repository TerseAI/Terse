import { SurveyConfigContext, SurveyQuestion, GenerateSurveyPromptRequest, SKIP_OPTION } from '../../shared/PromptBuilderTypes';

export function formatConfigContext(
    inputConfigs?: SurveyConfigContext[],
    outputConfig?: SurveyConfigContext
): string {
    let context = '';

    if (inputConfigs && inputConfigs.length > 0) {
        context += 'Input Sources:\n';
        inputConfigs.forEach((config, idx) => {
            context += `  ${idx + 1}. ${config.type}\n`;
        });
    }

    if (outputConfig) {
        context += `Output Destination: ${outputConfig.type}\n`;
    }

    return context || 'No integrations configured yet.';
}

export function formatSurveyAnswers(
    questions: SurveyQuestion[],
    answers: GenerateSurveyPromptRequest['answers'],
    writeInAnswers?: GenerateSurveyPromptRequest['writeInAnswers']
): string {
    // Format answers for the prompt with full question and option context
    const answersText = Object.entries(answers)
        .map(([questionIdx, answer]) => {
            const question = questions[parseInt(questionIdx)];
            if (!question) return null;

            if (Array.isArray(answer)) {
                if (answer.length === 0 || answer.includes(SKIP_OPTION)) return null;
                const selectedOptions = answer
                    .filter(a => a !== SKIP_OPTION)
                    .map(letter => `${letter.toUpperCase()}) ${question.options[letter as keyof typeof question.options]}`)
                    .join(', ');
                const writeIn = writeInAnswers?.[questionIdx];
                return `Q: ${question.question}\nA: ${selectedOptions}${writeIn ? ` (Write-in: ${writeIn})` : ''}`;
            } else {
                if (answer === SKIP_OPTION) return null;
                // Map answer letter to actual option text
                const selectedOption = `${answer.toUpperCase()}) ${question.options[answer as keyof typeof question.options]}`;
                const writeIn = writeInAnswers?.[questionIdx];
                return `Q: ${question.question}\nA: ${selectedOption}${writeIn ? ` (Write-in: ${writeIn})` : ''}`;
            }
        })
        .filter(Boolean)
        .join('\n\n');

    // Include write-in only answers (when user only provided write-in, no option selected)
    const writeInOnlyText = Object.entries(writeInAnswers || {})
        .filter(([questionIdx]) => {
            const answer = answers[questionIdx];
            if (Array.isArray(answer)) {
                return answer.length === 0 || (answer.length === 1 && answer[0] === SKIP_OPTION);
            }
            return !answer || answer === SKIP_OPTION;
        })
        .map(([questionIdx, writeIn]) => {
            if (writeIn && typeof writeIn === 'string' && writeIn.trim()) {
                const question = questions[parseInt(questionIdx)];
                if (question) {
                    return `Q: ${question.question}\nA: (Write-in): ${writeIn}`;
                }
            }
            return null;
        })
        .filter(Boolean)
        .join('\n\n');

    const allAnswersText = [answersText, writeInOnlyText].filter(Boolean).join('\n');
    return allAnswersText;
}

