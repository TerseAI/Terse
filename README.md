# Terse - The best Agent Builder For Software Teams

# Introduction

Terse is an Agent Builder build for the modern Software team. With the power of AI, writing code is no longer the bottleneck, it's all of the stuff around it. Code reviews, release notes, project statuses, tracking feedback etc...

Terse is a flexible platform that deeply integrates (can analyze video photo and text) with Linear Github Slack Notion PostHog Datadog etc... In minutes, you can build an background agent perfectly tailored to your workflow to help relieve these bottlenecks as they come up in your team.

## Package Manager

This project uses **pnpm** (not npm or yarn). Install it if you haven't:

```bash
npm install -g pnpm
```

Then install dependencies:

```bash
# In /frontend
pnpm install

# In /backend
pnpm install
```

## Code Formatting

We use **Prettier** for consistent code formatting across the team.

### Setup (One-time)

1. **Install the Prettier VS Code extension**
   - Search for "Prettier - Code formatter" in VS Code/Cursor extensions
   - Or install from: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode

2. **Install dependencies** (if you haven't already)
   ```bash
   # In /frontend
   pnpm install

   # In /backend
   pnpm install
   ```

That's it! The repo includes:
- `.prettierrc` - Formatting rules (picked up automatically by the extension)
- `.vscode/settings.json` - Enables format-on-save for the whole team

### How It Works

- **Format on save**: Files auto-format when you save (Cmd+S / Ctrl+S)
- **Manual format**: Right-click → "Format Document" or use Shift+Alt+F (Windows) / Shift+Option+F (Mac)
- **Format entire codebase**:
  ```bash
  cd backend && pnpm run format
  cd frontend && pnpm run format
  ```
- **Check formatting (CI)**:
  ```bash
  pnpm run format:check
  ```
## Local Dev

you will need to make an ngrok account and get a dedicated dev url + access token. Then set the following env variables in backend/.env

NGROK_AUTH_TOKEN=38Zg3QagX6X9AnYc6WKqwedwefdGCY21_2nVjhcyeynHFNmnr7ijBw
NGROK_DOMAIN=abbie-smoking-yetta.ngrok-free.dev

Then, install ngrok with brew

```
brew install ngrok
```

After that, simply run pnpm run dev:tunnel and the rest will be taken care of.

Make sure to set your test apps (Slack github etc...) to the ngrok url.

## Database Migrations

We use Prisma with migrations.

1. Update the schema file. When you are happy, run the following **in the /backend folder**

```bash
pnpm exec prisma migrate dev --name <some_name>
```

When you are happy with local changes, you can push to prod. 

Production URL can be found on Render.com dashboard. (Or you can ask me)

```bash
DATABASE_URL="your_production_url" pnpm exec prisma migrate deploy
```
