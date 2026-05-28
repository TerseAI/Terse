# Self-hosting Terse

```bash
npx create-terse
```

Brings up the full Terse control plane — backend, dashboard, Postgres — as Docker containers in a directory of your choice. Migrations run on startup; the `terse` CLI gets pointed at the new instance automatically. Prerequisites: Docker with Compose v2, Node 20+.

Open the frontend URL when the script finishes. The first request creates the admin identity and signs you in.

## What you're running

A single-operator install. The local auth provider has no signup form, so the first request to the backend becomes the admin. The local sandbox runs job code as subprocesses inside the backend container without per-run isolation. SQLite stores local identities and encrypted secrets; Postgres stores everything else.

Both auth and sandbox isolation are opt-in upgrades. Set `WORKOS_*` in `.env` for real multi-user auth. Set `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` for per-run isolated sandboxes.

## Before exposing the install

- Put it behind an authenticated proxy. There's no built-in auth wall, and anyone who reaches the backend URL becomes the admin.
- Set `NODE_ENV=production` in `.env` and restart so session cookies are marked `secure`.
- Back up `LOCAL_SECRETS_ENCRYPTION_KEY` out of band. Lose it, and every stored integration credential is unrecoverable.
- Don't run untrusted job code. The local sandbox provider doesn't isolate it.

## Docs and ops

- Full guide: [docs.useterse.ai/self-hosting-control-plane](https://docs.useterse.ai/self-hosting-control-plane)
- Daily ops (logs, upgrade, backup): the `README.md` written into your install directory
- Bugs: [github.com/TerseAI/Terse/issues](https://github.com/TerseAI/Terse/issues)
- Security: [SECURITY.md](./SECURITY.md)
