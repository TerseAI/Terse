import chalk from "chalk"

type MissingEntryFileGuidanceOptions = {
    languageDisplayName: string
    defaultEntryFile: string
    requestedEntryFile?: string
    overrideExample: string
    createHint: string
}

export function printMissingEntryFileGuidance(options: MissingEntryFileGuidanceOptions): never {
    const requestedEntryFile = options.requestedEntryFile ?? options.defaultEntryFile
    const isDefaultEntry = requestedEntryFile === options.defaultEntryFile

    if (isDefaultEntry) {
        console.error(chalk.red(`Error: Could not find the default ${options.languageDisplayName} Terse entry file at ${options.defaultEntryFile}.`))
        console.error(chalk.dim(options.createHint))
        console.error(chalk.dim("If your self-hosted or custom layout registers jobs elsewhere, rerun with --entry-file:"))
    } else {
        console.error(chalk.red(`Error: Could not find the specified entry file at ${requestedEntryFile}.`))
        console.error(chalk.dim(`The default ${options.languageDisplayName} Terse entry file is ${options.defaultEntryFile}.`))
        console.error(chalk.dim("Use a valid --entry-file path, or move your jobs to the default entry file."))
    }

    console.error(chalk.dim(`  terse test --entry-file ${options.overrideExample}`))
    console.error(chalk.dim(`  terse run my-job --entry-file ${options.overrideExample} --event-file ./event.json`))
    console.error(chalk.dim(`  terse deploy --entry-file ${options.overrideExample}`))
    process.exit(1)
}
