/** When this variable is present in the environment (any value), the sandbox-only subcommands (`terse run`, `terse build`) are registered. Backend-managed SDK sandboxes (Modal in cloud, LocalSandboxService in self-host) set it for job execution and image builds. */
const TERSE_CLI_ENABLE_RUN_ENV = "TERSE_CLI_ENABLE_RUN"

export function isCliRunCommandEnabled(): boolean {
    return process.env[TERSE_CLI_ENABLE_RUN_ENV] !== undefined
}
