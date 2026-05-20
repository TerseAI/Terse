import { ConfigData } from "terse-types"

import { Session } from "../../express"
import { Output } from "../../outputs/abstract/Output"

export interface SystemPromptBuilderDependencies<T extends Session, TConfig extends ConfigData> {
    session: T
    outputs: Output<TConfig>[]
}

interface Section {
    header: string
    content: string
}

type SectionBuilder = () => Section | null | Promise<Section | null>

export class BaseSystemPromptBuilder<T extends Session, TConfig extends ConfigData> {
    private sections: SectionBuilder[] = []

    constructor(protected deps: SystemPromptBuilderDependencies<T, TConfig>) {}

    withSection(builder: SectionBuilder): this {
        this.sections.push(builder)
        return this
    }

    withTimeSection(): this {
        return this.withSection(() => this.buildTimeSection())
    }

    withOutputsSection(): this {
        return this.withSection(() => this.buildOutputsSection())
    }

    async build(): Promise<string> {
        const results = await Promise.all(this.sections.map(fn => fn()))
        const validSections = results.filter((s): s is Section => s !== null)

        return validSections.map((section, index) => this.formatSection(section, index)).join("\n\n")
    }

    protected formatSection(section: Section, index: number): string {
        return `
=====================
${index}. ${section.header}
=====================
${section.content}
`.trim()
    }

    protected buildTimeSection(): Section {
        const currentTimeUtc = new Date().toISOString()
        return {
            header: "CURRENT TIME",
            content: `The current time in UTC is: ${currentTimeUtc}

Use this information to understand temporal context.`
        }
    }

    protected async buildOutputsSection(): Promise<Section | null> {
        if (!this.deps.outputs || this.deps.outputs.length === 0) {
            return null
        }

        const outputSections: string[] = []

        for (const output of this.deps.outputs) {
            if (!output || output.configs.length === 0) {
                continue
            }

            const instructions = await output.getRuntimeSystemInstructions({ userId: this.deps.session.user.id, organizationId: this.deps.session.user.organizationId })
            outputSections.push(instructions)
        }

        if (outputSections.length === 0) {
            return null
        }

        return {
            header: "OUTPUT INSTRUCTIONS",
            content: outputSections.join("\n\n")
        }
    }
}
