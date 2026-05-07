---
name: init
description: Set up Terse from scratch. Installs the terse CLI if missing, runs `terse init` to scaffold a project, and walks the user through the browser login. Use when the user wants to onboard, get started with Terse for the first time, or initialize a brand-new Terse project.
argument-hint: [project-name]
---

# Initialize Terse

Get the user fully set up on Terse: CLI installed, logged in, and a project scaffolded. Optional argument: **$ARGUMENTS** (project directory name).

## Reference docs

For anything beyond a vanilla setup, pull the live docs:

- Doc index: https://docs.useterse.ai/llms.txt
- CLI reference: https://docs.useterse.ai/reference/cli, the authoritative source for `terse init`, `terse login`, `terse integrate`, and friends.

## Steps

### 1. Check whether setup is already done

Before scaffolding anything, look at the current directory:

- If a `terse.config.json`, `terse.config.jsonc`, or `src/terse.generated.ts` already exists, this is an existing Terse project. Do **not** re-init. Confirm the user is logged in (`terse login` if needed) and point them at:
    - `/terse:create <description>` to add a new job
    - `terse integrate connect <type>` to connect more services
- If `package.json` exists in the current directory but no Terse files are present, the user wants to add Terse to an existing project. Use `terse attach` instead of `terse init` (which is for fresh scaffolds only). Stop here and surface that to the user.
- If the current directory is empty (or only contains things like `.git`, `README.md`), continue to the next step.

### 2. Verify the CLI is installed

```bash
terse --version
```

If the command is not found, install it globally. Recommend `npm i -g terse-cli` as the default, since most users have npm available:

```bash
npm i -g terse-cli
```

If the user is on pnpm or yarn and asks for that flavor, `pnpm add -g terse-cli` and `yarn global add terse-cli` work too.

After install, re-run `terse --version` to confirm it is on PATH.

### 3. Decide the scaffold target

- If `$ARGUMENTS` is provided, treat it as the project directory name. The CLI will create that subdirectory under the current working directory.
- If `$ARGUMENTS` is empty and the current directory is empty, scaffold into the current directory (no argument).
- If `$ARGUMENTS` is empty but the user clearly named the project in conversation, use that name as the argument.

### 4. Make sure the user is logged in (do this BEFORE `terse init`)

This is the step that trips up most agents. Read this carefully.

The Bash tool runs commands without a TTY. When `terse login` (or `terse init`'s embedded login step) detects a non-TTY environment with no stored API key, it bails out with `ACTION REQUIRED: Not authenticated.` and exit code 2 instead of opening a browser. So the agent **cannot** trigger the device-code login itself. The login has to happen in the user's real terminal.

First, check whether the user is already logged in. The auth file lives at `~/.terse/auth` (or `$XDG_CONFIG_HOME/terse/auth`). The simplest robust check: try a command that requires auth and see if it errors:

```bash
terse integrate list --json
```

- If it returns JSON or a normal listing, the user has a valid API key. Skip ahead to step 5.
- If it errors with `not_authenticated` or `ACTION REQUIRED: Not authenticated`, you need to ask the user to log in.

To log in, **do not** run `terse login` via Bash. Instead, tell the user something like:

> "Run `! terse login` in this prompt. A browser window will open for WorkOS sign-in. Once it says you're logged in, send me any message and I'll continue."

The `!` prefix runs the command in the user's interactive shell, which has a real TTY, so the device-code flow will open the browser and poll until completion. Wait for the user to confirm they're back, then run `terse integrate list --json` again to verify the key is now valid.

### 5. Run `terse init` to scaffold and create the remote project

Now that the user is logged in, run the scaffold:

```bash
# In a fresh subdirectory:
terse init <project-name>

# Or in the current empty directory:
terse init
```

Because the Bash tool has no TTY, `terse init` automatically runs in non-interactive mode. With a valid stored API key it will:

- scaffold the project files
- install dependencies with the detected package manager
- create the remote Terse project and write `terse.config.json`
- run `terse generate`
- skip the interactive integration picker (this is fine; integrations get connected in the handoff step)

Set the Bash timeout to 600000 (10 minutes) to give `pnpm install` plenty of room.

### 6. Handle the most common failure modes

- **`ACTION REQUIRED: Not authenticated`**: the stored API key is missing or expired. Loop back to step 4 and ask the user to run `! terse login` again.
- **"Detected an existing npm project in this directory"**: the user is in a populated directory with no project name argument. Either retry with a project name argument (creates a subdirectory) or run `terse attach` to add Terse to the existing project.
- **"Directory already exists"**: the named subdirectory is already there. Pick a different name or `cd` into the existing one and re-evaluate from step 1.
- **Failed to create Terse project**: the API key is valid but the remote project creation failed. The local scaffold still exists; surface the error and suggest re-running `terse init` after fixing connectivity, or manually creating the project in the dashboard.
- **Scaffold succeeded but auth failed mid-init**: if a previous run got as far as scaffolding files before failing on auth, the directory is no longer empty. Do not re-run `terse init` blindly because it will refuse on account of the existing scaffold. Just confirm the user is logged in (step 4), then run `terse generate` to finish wiring up the helpers, and create the remote project from the dashboard if `terse.config.json` is missing.

### 7. Confirm the setup landed

After `terse init` returns successfully, verify:

- `terse.config.json` (or `.jsonc`) exists with a `projectId`
- `src/terse.jobs.ts` and `src/terse.generated.ts` exist
- `node_modules` is populated (the CLI auto-installs deps)

If any are missing, follow up with the corresponding manual step (`pnpm install`, `terse generate`, etc.) using whatever package manager the scaffold chose.

### 8. Hand off cleanly

Tell the user what they can do next, in order of likelihood:

1. Connect more integrations: `terse integrate connect <type>` (or `terse integrate list --json` to see what's available).
2. Use `/terse:create <description>` to scaffold their first job.
3. Run `terse deploy` once a job is written and they want it running in production.

Keep the handoff short. The CLI itself prints a "Next steps" block at the end of `terse init`, so do not duplicate that verbatim. Just reinforce the one or two things the user said they wanted to do.
