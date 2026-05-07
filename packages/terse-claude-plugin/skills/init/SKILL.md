---
name: init
description: Set up Terse from scratch. Installs the terse CLI if missing, runs `terse init` to scaffold a project, and walks the user through the browser login. Use when the user wants to onboard, get started with Terse for the first time, or initialize a brand-new Terse project.
argument-hint: [project-name]
---

# Initialize Terse

Get the user fully set up on Terse: CLI installed, logged in, and a project scaffolded. Optional argument: **$ARGUMENTS** (project directory name).

## How to think about this

Don't preflight. Don't run `find`, `ls`, `terse --version`, or `terse integrate list` to "check the environment" before doing anything. Just run `terse init` and react to whatever it tells you. The CLI already knows how to detect existing projects, missing auth, taken directory names, and a missing `package.json`. Trust its error messages and recover from them.

## Reference docs

For anything beyond a vanilla setup, pull the live docs:

- Doc index: https://docs.useterse.ai/llms.txt
- CLI reference: https://docs.useterse.ai/reference/cli, the authoritative source for `terse init`, `terse login`, `terse integrate`, and friends.

## Steps

### 1. Run `terse init`

```bash
terse init <project-name>   # scaffold into a new subdirectory
terse init                  # scaffold into the current directory (must be empty of npm files)
```

Use the project name from `$ARGUMENTS` if provided, otherwise scaffold into the current directory.

Set the Bash timeout to 600000 (10 minutes). Dependency install and browser-side auth can both take a while.

`terse init` handles auth itself: if the user is not logged in, it opens the browser to WorkOS and waits for them to authorize. Tell the user a browser tab may pop up. The single command scaffolds files, installs dependencies, logs in if needed, creates the remote Terse project, writes `terse.config.json`, and runs `terse generate`.

### 2. React to errors

If `terse init` fails, read the error and recover:

- **`command not found: terse`**: install the CLI with `npm i -g terse-cli` (or `pnpm add -g terse-cli` / `yarn global add terse-cli` if the user prefers), then retry `terse init`.
- **`Detected an existing npm project in this directory`**: the directory has a `package.json`. If it also has a `terse.config.json` or `src/terse.generated.ts`, the user is already set up: stop, do not re-init, and offer `/terse:create` for adding a job. If it is some other npm project, recommend `terse attach` (adds Terse to an existing project) or rerun with a project name to scaffold a sibling directory.
- **`Directory "X" already exists`**: pick a different project name, or have the user `cd` into the existing directory so you can evaluate from there.
- **`ACTION REQUIRED: Not authenticated`**: only happens if the user passed `--non-interactive` (CI mode) or the device-code flow timed out. Run `terse login` via Bash with a 10-minute timeout, then retry `terse init`.
- **`Failed to create Terse project`**: the API key is valid but the remote create failed. The local scaffold still exists. Surface the error to the user and suggest retrying after fixing connectivity, or creating the project from the dashboard and writing `terse.config.json` manually.

### 3. Hand off

The CLI prints a "Next steps" block at the end of a successful `terse init`. Don't repeat it verbatim. Just remind the user of the one or two things they said they wanted to do, in this order of likelihood:

1. Connect more integrations: `terse integrate connect <type>`.
2. Use `/terse:create <description>` to scaffold their first job.
3. Run `terse deploy` once a job is written.
