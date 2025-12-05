# Terse AI - Cursor Rules

Terse AI builds background AI agents that automatically sync your tools, eliminating manual work and reducing information drift across software teams. The platform integrates seamlessly with tools teams already use—keeping everything in sync while teams focus on what matters most.

## Tech Stack

- **Backend**: Express.js, Prisma ORM, Socket.io, OpenAI Agents SDK
- **Frontend**: React 19, Vite, Tailwind CSS, Radix UI, SWR
- **Database**: PostgreSQL with pgvector
- **Language**: TypeScript (always)

## Getting Started

### Prerequisites

- Node.js v22.19.0

### Running the Project

Both frontend and backend are started with:

```bash
# In /backend
npm run dev

# In /frontend
npm run dev
```

Backend runs on `http://localhost:3001`.

### Environment Setup

- **Frontend**: Copy `.env.example` directly
- **Backend**: Copy `.env.example` and fill in values (see `backend/src/config/settings.ts` for details)

## Development Workflow

### Type Checking

Before committing, validate TypeScript compilation in both repos:

```bash
# In /backend
npm run build

# In /frontend
npm run build
```

Always run `npm run build` after making changes to verify nothing is broken.

### Shared Types

Types shared between frontend and backend are defined in the `/shared` folder. After modifying shared types:

```bash
# From root
node scripts/copy-shared.js
```

This copies types to both `frontend/src/shared/` and `backend/src/shared/`.

Key shared files:
- `shared/types.ts` - Core entity types (Channel, User, etc.)
- `shared/Integrations.ts` - Integration types and metadata
- `shared/Configs.ts` - Config classes for each integration type

### Database (Prisma)

All Prisma commands must be run from the `/backend` folder:

```bash
# Generate Prisma client (run after schema changes)
npx prisma generate

# Apply migrations and regenerate client
npx prisma migrate dev --name <migration_name>

# Open Prisma Studio
npx prisma studio
```

## Architecture Overview

### Core Concepts

- **Channel**: An automation that connects inputs (data sources) to an output (destination)
- **Integration**: A connected third-party service (Slack, Notion, GitHub, etc.)
- **Input**: Event source that triggers the agent (e.g., Slack message, GitHub PR)
- **Output**: Destination where the agent writes (e.g., Notion database, Linear)
## Code Style Guidelines

### General

- **Always write TypeScript**—no JavaScript files
- **Minimize comments**—only comment when something is non-obvious or explaining *why* something is done a certain way
- **No JSDoc**—we don't use it

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Functions | camelCase | `fetchUserData` |
| Components | PascalCase | `UserProfile` |
| Component folders (large/page-level) | PascalCase | `ChannelEditor/` |
| Component folders (reusable/small) | lowercase | `button/`, `input/` |
| Variables | camelCase | `userName` |

### Frontend

- **No `useCallback`**—avoid or eliminate its use
- **State management**: Use `useState` for local state, SWR for server state
- **Styling**: Tailwind CSS exclusively—stick to theme variables for consistency
- **API calls**: Use `BackendProvider` service (`frontend/src/services/backend.tsx`)
- **Data fetching hooks**: Build on SWR using `BackendProvider`, following patterns in `frontend/src/hooks/api/`

#### Hook Pattern Example

```typescript
import useSWR from 'swr';
import { BackendProvider } from '@/services/backend';

export function useChannels(params = {}) {
    const key = ['channels', params];
    
    const { data, error, isValidating, mutate } = useSWR(
        key,
        async () => BackendProvider.getUserChannels(params.page, params.limit),
    );

    return {
        channels: data?.channels ?? [],
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate,
    };
}
```

#### Cache Invalidation

SWR cache invalidation happens via Socket.io events. The backend emits `invalidate` events with a key, and the frontend invalidates matching SWR keys:

```typescript
// Backend emits
emitCacheInvalidationWithKey(userId, 'recentChannels');

// Frontend listens in socket.ts and calls
mutate((k) => Array.isArray(k) && k[0] === key);
```

### Backend

- Express routes are in `backend/src/routes/`
- Agent implementations are in `backend/src/agent/`
- Integration handlers are in `backend/src/integrations/`
- Use `db()` from `prismaClient.ts` for database access
- Use `chalk` for colored console logging

#### Route Pattern Example

```typescript
export async function getUserChannels(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = req.session.user.id;

    try {
        const channels = await db().automations.findMany({
            where: { user_id: userId },
        });
        res.status(200).json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
}
```

## Things We DO NOT Want

1. ❌ `useCallback` in frontend code
2. ❌ Excessive comments—code should be self-documenting
3. ❌ JSDoc comments
4. ❌ JavaScript files—TypeScript only
5. ❌ Direct API calls without using `BackendProvider`
6. ❌ Inline styles or CSS files—use Tailwind only
7. ❌ Skipping `npm run build` validation before committing
