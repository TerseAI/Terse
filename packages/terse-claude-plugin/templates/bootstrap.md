**Run `terse init`.** Don't preflight. Don't run `find`, `ls`, `terse --version`, or `terse integrate list` to "check the environment" before doing anything. Just run `terse init` and react to whatever it tells you. The CLI already knows how to detect existing projects, missing auth, taken directory names, and a missing `package.json`. Trust its error messages and recover from them.

```bash
terse init <project-name>   # scaffold into a new subdirectory
terse init                  # scaffold into the current directory (must be empty of npm files)
```

If the user named a project directory, pass it; otherwise scaffold into the current directory.

Set the Bash timeout to 600000 (10 minutes). Dependency install and browser-side auth can both take a while.

`terse init` handles auth itself: if the user is not logged in, it opens the browser to WorkOS and waits for them to authorize. Before running it, tell the user casually that a browser tab may pop up and that the setup pauses until they finish signing in there. If the CLI prints a login URL and the user seems stuck, relay that URL as a clickable fallback — the automatic browser open fails silently over SSH or in a container. The single command scaffolds files, installs dependencies, logs in if needed, creates the remote Terse project, writes `terse.config.json`, and runs `terse generate`.

**React to errors.** If `terse init` fails, read the error and recover:

- **`command not found: terse`**: install the CLI with `npm i -g terse-cli` (or `pnpm add -g terse-cli` / `yarn global add terse-cli` if the user prefers), then retry `terse init`.
- **`Detected an existing npm project in this directory`**: the directory has a `package.json`. If it also has a `terse.config.json` or `src/terse.generated.ts`, the user is already set up: stop, do not re-init, and continue with step 1. If it is some other npm project, recommend `terse attach` (adds Terse to an existing project) or rerun with a project name to scaffold a sibling directory.
- **`Directory "X" already exists`**: pick a different project name, or have the user `cd` into the existing directory so you can evaluate from there.
- **`ACTION REQUIRED: Not authenticated`**: only happens in non-interactive / CI mode when no valid stored credentials are present. Run `terse auth login` via Bash with a 10-minute timeout, then retry `terse init`.
- **`Failed to create Terse project`**: the API key is valid but the remote create failed. The local scaffold still exists. Surface the error to the user and suggest retrying after fixing connectivity, or creating the project from the dashboard and writing `terse.config.json` manually.

**Continue.** The CLI prints a "Next steps" block at the end of a successful `terse init`. Don't repeat it verbatim. Connect any integrations the requested workflow needs — run `terse integrate describe <type> --json` first to learn whether the install is form or OAuth and which fields it requires, then `terse integrate connect <type>` per step 7. Then continue with step 1 and build the workflow the user asked for.
