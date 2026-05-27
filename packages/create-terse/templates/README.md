# Terse (self-hosted)

You're running a self-hosted Terse instance. This directory holds everything needed to operate it:

```
docker-compose.yml   # service definitions (postgres, backend, frontend)
.env                 # all configuration (URLs, ports, secrets) — edit here
README.md            # you are here
```

## Daily operations

| Goal                          | Command                              |
| ----------------------------- | ------------------------------------ |
| Open the UI                   | visit the `FRONTEND_URL` from `.env` |
| Tail logs (all services)      | `docker compose logs -f`             |
| Tail backend only             | `docker compose logs -f backend`     |
| Restart after editing `.env`  | `docker compose up -d`               |
| Stop everything               | `docker compose down`                |
| Stop and delete all data      | `docker compose down -v`             |
| Pull the latest image         | `docker compose pull && docker compose up -d` |
| Open a shell in the backend   | `docker compose exec backend sh`     |
| Check service status          | `docker compose ps`                  |

## What's running

- **postgres** — Postgres 16, data persisted in the `terse_postgres` Docker volume.
- **backend** — Terse API, port from `BACKEND_URL` in `.env`. SQLite for local secrets lives in the `terse_sqlite` volume.
- **frontend** — Vite dev server, port from `FRONTEND_URL` in `.env`.

Both backend and frontend run from the same prebuilt image: `us-central1-docker.pkg.dev/terse-prod/public/terse:latest`. To pin to a specific tag, uncomment `TERSE_IMAGE=` at the bottom of `.env`.

## Configuration

Everything user-tunable lives in `.env`:

- **URLs** — `FRONTEND_URL` / `BACKEND_URL` must match what your browser sees. If you put Terse behind a reverse proxy or a real domain, change both and restart.
- **Postgres** — credentials and host port. Change before first start; changing later requires `docker compose down -v` (destroys data).
- **Secrets** — `JWT_SECRET` and `LOCAL_SECRETS_ENCRYPTION_KEY` are generated for you. Rotating `LOCAL_SECRETS_ENCRYPTION_KEY` invalidates any stored integration credentials.

After any edit, run `docker compose up -d` to apply.

## The `terse` CLI

The installer also globally installs `terse-cli` (`npm i -g terse-cli`) and points it at this instance. From any directory:

```
terse target       # show which backend the CLI talks to
terse init my-job  # scaffold a new job
terse deploy       # deploy a job to your instance
```

CLI reference: [docs.useterse.ai/reference/cli](https://docs.useterse.ai/reference/cli).

## Upgrading

```
docker compose pull
docker compose up -d
```

The `latest` tag is updated on every push to `main` in the [TerseAI/Terse](https://github.com/TerseAI/Terse) repo. Pin `TERSE_IMAGE` in `.env` if you want explicit control over upgrades.

## Backups

The only stateful data lives in two Docker volumes:

```
docker volume ls | grep terse
# terse_postgres   ← Postgres data
# terse_sqlite     ← local secrets DB
```

Back them up with `docker run --rm -v terse_postgres:/data -v $PWD:/backup alpine tar czf /backup/postgres.tar.gz -C /data .` (and similarly for `terse_sqlite`).

## Resources

- **Docs** — [docs.useterse.ai](https://docs.useterse.ai)
- **Quickstart** — [docs.useterse.ai/quickstart](https://docs.useterse.ai/quickstart)
- **Self-hosting guide** — [docs.useterse.ai/self-hosting](https://docs.useterse.ai/self-hosting)
- **SDK reference** — [docs.useterse.ai/reference/typescript-sdk](https://docs.useterse.ai/reference/typescript-sdk)
- **Website** — [useterse.ai](https://useterse.ai)
- **Source** — [github.com/TerseAI/Terse](https://github.com/TerseAI/Terse)

## Getting help

- **Bugs / feature requests** — open an issue at [github.com/TerseAI/Terse/issues](https://github.com/TerseAI/Terse/issues). Include `docker compose logs` output and the relevant section of `.env` (with secrets redacted).
- **Questions** — check [docs.useterse.ai](https://docs.useterse.ai) first, then open a Discussion at [github.com/TerseAI/Terse/discussions](https://github.com/TerseAI/Terse/discussions).

## Contributing

Terse is open source. The contribution guide lives in the repo at [CONTRIBUTING.md](https://github.com/TerseAI/Terse/blob/main/CONTRIBUTING.md). PRs welcome for bug fixes, integrations, and docs improvements.
