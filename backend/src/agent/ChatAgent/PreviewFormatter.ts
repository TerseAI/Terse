import { Channel, ChannelInput, ChannelOutput, ChannelKnowledgeBase } from "../../shared/types";
import { CONFIG_DETAILS } from "../../shared/Configs";

export function formatChannelPreview(channel: Channel): string {
    const sections: string[] = [];

    // Name
    if (channel.name) {
        sections.push(`*Automation Name:* ${channel.name}`);
    } else {
        sections.push(`*Automation Name:* (not set)`);
    }

    // Status
    const status = channel.isActive ? '✅ Active' : '⏸️ Inactive';
    sections.push(`*Status:* ${status}`);

    // Approval requirement
    if (channel.requireApproval) {
        sections.push(`*Requires Approval:* Yes`);
    }

    // Inputs
    if (channel.inputs && channel.inputs.length > 0) {
        sections.push(`\n*Inputs (${channel.inputs.length}):*`);
        channel.inputs.forEach((input, index) => {
            const configDetails = CONFIG_DETAILS[input.config.configType];
            const configSummary = input.config.formatForAgent();
            const isComplete = input.config.isComplete();
            const statusIcon = isComplete ? '✅' : '⚠️';
            sections.push(`${statusIcon} ${index + 1}. ${configDetails.name}`);
            sections.push(`   ${configSummary.split('\n').join('\n   ')}`);
            if (!isComplete) {
                sections.push(`   ⚠️ Incomplete configuration`);
            }
        });
    } else {
        sections.push(`\n*Inputs:* None configured`);
    }

    // Output
    if (channel.output) {
        sections.push(`\n*Output:*`);
        const configDetails = CONFIG_DETAILS[channel.output.config.configType];
        const configSummary = channel.output.config.formatForAgent();
        const isComplete = channel.output.config.isComplete();
        const statusIcon = isComplete ? '✅' : '⚠️';
        sections.push(`${statusIcon} ${configDetails.name}`);
        sections.push(`   ${configSummary.split('\n').join('\n   ')}`);
        if (!isComplete) {
            sections.push(`   ⚠️ Incomplete configuration`);
        }
    } else {
        sections.push(`\n*Output:* Not configured`);
    }

    // Knowledge Bases
    if (channel.knowledgeBases && channel.knowledgeBases.length > 0) {
        sections.push(`\n*Knowledge Bases (${channel.knowledgeBases.length}):*`);
        channel.knowledgeBases.forEach((kb, index) => {
            const configDetails = CONFIG_DETAILS[kb.config.configType];
            const configSummary = kb.config.formatForAgent();
            const isComplete = kb.config.isComplete();
            const statusIcon = isComplete ? '✅' : '⚠️';
            sections.push(`${statusIcon} ${index + 1}. ${configDetails.name}`);
            sections.push(`   ${configSummary.split('\n').join('\n   ')}`);
            if (!isComplete) {
                sections.push(`   ⚠️ Incomplete configuration`);
            }
        });
    }

    // Prompt
    if (channel.prompt && channel.prompt.text) {
        sections.push(`\n*Prompt:*`);
        sections.push(channel.prompt.text);
    } else {
        sections.push(`\n*Prompt:* Not set`);
    }

    // Check for incomplete sections
    const incompleteInputs = channel.inputs?.filter(input => !input.config.isComplete()).length || 0;
    const incompleteOutput = channel.output && !channel.output.config.isComplete();
    const incompleteKBs = channel.knowledgeBases?.filter(kb => !kb.config.isComplete()).length || 0;
    const missingPrompt = !channel.prompt || !channel.prompt.text;

    if (incompleteInputs > 0 || incompleteOutput || incompleteKBs > 0 || missingPrompt) {
        sections.push(`\n⚠️ *Incomplete Sections:*`);
        if (incompleteInputs > 0) {
            sections.push(`- ${incompleteInputs} input(s) need configuration`);
        }
        if (incompleteOutput) {
            sections.push(`- Output needs configuration`);
        }
        if (incompleteKBs > 0) {
            sections.push(`- ${incompleteKBs} knowledge base(s) need configuration`);
        }
        if (missingPrompt) {
            sections.push(`- Prompt is not set`);
        }
    }

    return sections.join('\n');
}
