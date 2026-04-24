import { CliError } from "../../cliError.js"

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
        throw new CliError(`entry_file_not_found`, `Could not find the default ${options.languageDisplayName} Terse entry file at ${options.defaultEntryFile}.`, {
            detail: `${options.createHint}\nIf your self-hosted or custom layout registers jobs elsewhere, rerun with --entry-file:\n  terse test --entry-file ${options.overrideExample}\n  terse deploy --entry-file ${options.overrideExample}`
        })
    }

    throw new CliError("entry_file_not_found", `Could not find the specified entry file at ${requestedEntryFile}.`, {
        detail: `The default ${options.languageDisplayName} Terse entry file is ${options.defaultEntryFile}.\nUse a valid --entry-file path, or move your jobs to the default entry file.\n  terse test --entry-file ${options.overrideExample}\n  terse deploy --entry-file ${options.overrideExample}`
    })
}
