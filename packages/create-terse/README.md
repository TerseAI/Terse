# create-terse

Scaffold and launch a self-hosted [Terse](https://useterse.ai) instance with one command.

Terse is the AI workflow platform for coding agents. You write workflows in TypeScript, generate a typed SDK from your connected integrations, and deploy them. Full docs at [docs.useterse.ai](https://docs.useterse.ai).

## Usage

```bash
npm create terse
```

or

```bash
npx create-terse
```

This walks you through a short setup, writes a `docker-compose.yml` and `.env` into a target directory, pulls the Terse image, starts the services (Postgres, backend, frontend), and installs the `terse` CLI pointed at your new instance.

## Options

```bash
npx create-terse [options]
```

| Option | Description |
|---|---|
| `-y`, `--non-interactive` | Skip prompts and use defaults (auto-enabled when stdin/stdout is not a TTY). |
| `--target <dir>` | Target directory (default: `./terse`). |
| `--frontend-url <url>` | Frontend URL as seen from your browser (default: `http://localhost:5173`). |
| `--backend-url <url>` | Backend URL as seen from your browser (default: `http://localhost:3001`). |
| `--no-open` | Don't open the frontend in your browser when setup completes. |
| `-h`, `--help` | Show help. |

### Examples

```bash
npm create terse
npx create-terse -y
npx create-terse -y --target ./my-terse --backend-url http://localhost:3001
```

## Requirements

- Node.js >= 18
- Docker with Compose v2 (`docker compose`)

## After setup

The generated `README.md` in your target directory covers daily operations (logs, upgrades, backups, troubleshooting). See the [self-hosting guide](https://docs.useterse.ai/self-hosting) for the full walkthrough.

## License

See [LICENSE.md](./LICENSE.md).
