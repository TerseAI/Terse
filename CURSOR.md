# Terse AI - Cursor Rules

Terse AI builds background AI agents that automatically sync your tools, eliminating manual work and reducing information drift across software teams. The platform integrates seamlessly with tools teams already use—keeping everything in sync while teams focus on what matters most.

## Tech Stack

- **Backend**: Express.js, Prisma ORM, Socket.io, OpenAI Agents SDK
- **Frontend**: React 19, Vite, Tailwind CSS, Radix UI, SWR
- **Database**: PostgreSQL with pgvector
- **Language**: TypeScript (always)
- **Package Manager**: pnpm (not npm or yarn)

## Getting Started

### Prerequisites

- Node.js v22.19.0

### Running the Project

Both frontend and backend are started with:

```bash
# In /backend
pnpm run dev

# In /frontend
pnpm run dev
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
pnpm run build

# In /frontend
pnpm run build
```

Always run `pnpm run build` after making changes to verify nothing is broken.

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
pnpm exec prisma generate

# Apply migrations and regenerate client
pnpm exec prisma migrate dev --name <migration_name>

# Open Prisma Studio
pnpm exec prisma studio
```

## Architecture Overview

### Core Concepts

- **Channel**: An automation that connects inputs (data sources) to an output (destination)
- **Integration**: A connected third-party service (Slack, Notion, GitHub, etc.)
- **Input**: Event source that triggers the agent (e.g., Slack message, GitHub PR)
- **Output**: Destination where the agent writes (e.g., Notion database, Linear)
- **Knowledge Base**: A data source that agents can query for context (e.g., PostHog, GitHub, LaunchDarkly)

## Integration Setup Guide

This guide covers the complete process of adding a new integration to Terse. **Follow this checklist in order** to avoid missing critical steps.

### Planning Stage (CRITICAL - Do This First)

Before writing any code, complete these planning steps:

1. **Study Existing Patterns**
   - Find a similar integration (e.g., PostHog for knowledge bases, GitHub for knowledge bases, Slack for OAuth)
   - Review the integration manager implementation
   - Review the knowledge base implementation (if applicable)
   - Review the frontend components
   - **Understand the pattern before deviating**

2. **API Research**
   - Document authentication method (API key, OAuth, etc.)
   - Identify validation endpoint (e.g., `/api/v2/members/me` for LaunchDarkly)
   - List required API endpoints
   - Note any special headers or authentication formats
   - **Identify endpoints for fetching selectable options** (e.g., projects, environments, workspaces) - users should never have to manually type IDs or keys
   - **Identify what human-readable information is available** (e.g., token names, workspace names, project names) - avoid showing IDs to users

3. **Database Schema Planning**
   - Identify required Prisma models:
     - `{integration}_integrations` table (for storing credentials)
     - `automation_{integration}_configs` table (if knowledge base or input/output)
   - Determine which enums need updating:
     - `IntegrationType` enum
     - `KnowledgeBaseConfigType` enum (if knowledge base)
     - `InputConfigType` enum (if input)
     - `OutputConfigType` enum (if output)

4. **Shared Types Planning**
   - Plan `IntegrationType` addition in `shared/Integrations.ts`
   - Plan `ConfigType` addition in `shared/Configs.ts`
   - Design the `Config` class (extends `ConfigInstance`)
   - Plan integration metadata object

5. **Type Converter Planning**
   - **ALL 4 integration type converters** in `backend/src/utility/typeConverters.ts`:
     - `convertIntegrationTypeToPrismaIntegrationType()`
     - `convertPrismaIntegrationTypeToIntegrationType()`
     - `convertIntegrationTypeToPrismaIntegrationTypeForRunHistory()`
     - `convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory()`
   - If knowledge base: `convertConfigTypeToKnowledgeBaseConfigType()`
   - If knowledge base: `convertPrismaKnowledgeBaseConfigToConfigInstance()`
   - If input: `convertPrismaConfigToConfigInstance()` (add case)
   - If output: `convertPrismaOutputConfigToConfigInstance()` (add case)

6. **Frontend Planning**
   - Integration card component (or return `null` if not needed)
   - Knowledge base selector component (if knowledge base)
   - SWR hook for fetching integrations
   - Invalidation key function
   - Icon component (SVG or image)
   - ConfigUtils deserialization case

### Execution Checklist

Execute these steps **in order**, running builds after each major section:

#### 1. Database Schema (`backend/prisma/schema.prisma`)

- [ ] Add `{integration}_integrations` model (if storing credentials)
- [ ] Add `automation_{integration}_configs` model (if knowledge base/input/output)
- [ ] Add to `IntegrationType` enum
- [ ] Add to `KnowledgeBaseConfigType` enum (if knowledge base)
- [ ] Add relations to `users` model (if integration table)
- [ ] Add relations to `automation_knowledge_bases` model (if knowledge base config)
- [ ] Run `pnpm exec prisma generate` from `/backend`
- [ ] Run `pnpm exec prisma migrate dev --name add_{integration}_integration`

#### 2. Shared Types (`shared/`)

- [ ] Add to `IntegrationType` enum in `shared/Integrations.ts`
- [ ] Add integration metadata object in `shared/Integrations.ts`
- [ ] Update `INTEGRATION_METADATA` map
- [ ] Update `IntegrationInstallationOptions` type
- [ ] Add integration interface (if needed)
- [ ] Add to `ConfigType` enum in `shared/Configs.ts`
- [ ] Add config metadata object in `shared/Configs.ts`
- [ ] Update `CONFIG_DETAILS` map
- [ ] Create `{Integration}Config` class extending `ConfigInstance`
- [ ] Update `CONFIG_METADATA` map
- [ ] **Run `node scripts/copy-shared.js` from root** (CRITICAL - don't skip!)

#### 3. Backend Integration Manager (`backend/src/integrations/`)

- [ ] Create `{Integration}Integration.ts` file
- [ ] Implement `Integration` interface
- [ ] Implement `FormIntegrationInstallation` or `OAuthIntegrationInstallation` interface
- [ ] Implement `getInstancesForUser()`
- [ ] Implement `getAllActiveInstances()`
- [ ] Implement `processFormSubmission()` or OAuth handlers
- [ ] Implement `deleteInstallation()`
- [ ] Add to `IntegrationRegistry.ts`

#### 4. Backend Knowledge Base (if applicable) (`backend/src/knowledgeBase/`)

- [ ] Create `{integration}/` directory
- [ ] Create `{Integration}KnowledgeBase.ts` extending `KnowledgeBase`
- [ ] Define session interface extending `Session`
- [ ] Register tools in constructor
- [ ] Implement `createSessionFromConfig()`
- [ ] Implement `validateConfig()`
- [ ] Implement `addKnowledgeBaseToChannel()`
- [ ] Implement `getSystemInstructions()`
  - **Avoid repetition**: Tool descriptions are already available to the LLM, so don't duplicate them in system instructions
  - System instructions should focus on workflow, strategy, and best practices—not re-describe what tools do
  - Keep system instructions concise (~15-20 lines) focusing on when to use which tool and how
- [ ] Create tool files in `tools/` directory
- [ ] Each tool must return actions in the `actions` array of the return value (e.g., `return { success: true, result: {...}, actions: [{ action: '...', integration: ..., ... }] }`)
- [ ] Add to `KnowledgeBaseFactory.ts` registry

#### 5. Backend Routes (`backend/src/routes/`)

- [ ] Create `{integration}.ts` route file (if needed)
- [ ] Implement GET endpoint for fetching integrations
- [ ] Implement POST endpoint for creating/updating integration
- [ ] Register routes in `server.ts`

#### 6. Backend Type Converters (`backend/src/utility/typeConverters.ts`)

**CRITICAL: This is the most commonly missed step!**

- [ ] Import new `Config` class at top
- [ ] Add case to `convertIntegrationTypeToPrismaIntegrationType()`
- [ ] Add case to `convertPrismaIntegrationTypeToIntegrationType()`
- [ ] Add case to `convertIntegrationTypeToPrismaIntegrationTypeForRunHistory()`
- [ ] Add case to `convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory()`
- [ ] If knowledge base: Add case to `convertConfigTypeToKnowledgeBaseConfigType()`
- [ ] If knowledge base: Add case to `convertPrismaKnowledgeBaseConfigToConfigInstance()`
- [ ] If input: Add case to `convertPrismaConfigToConfigInstance()`
- [ ] If output: Add case to `convertPrismaOutputConfigToConfigInstance()`

#### 7. Backend Prisma Types (`backend/src/types/prisma.ts`)

- [ ] If knowledge base: Add `{integration}_config: true;` to `ChannelKnowledgeBaseWithConfigs` include object

#### 7b. Backend Prisma Includes (`backend/src/utility/prismaIncludes.ts`)

- [ ] **CRITICAL: If knowledge base**, add `{integration}_config: true;` to `getKnowledgeBaseConfigInclude()` function
  - This ensures the config relation is included when fetching channels
  - Without this, `convertPrismaKnowledgeBaseConfigToConfigInstance` will throw "Unsupported knowledge base config type" errors

#### 8. Frontend Services (`frontend/src/services/backend.tsx`)

- [ ] Add integration type import
- [ ] Add `get{Integration}Integrations()` method to interface and implementation
- [ ] Add `createOrUpdate{Integration}Integration()` method (if form-based)

#### 9. Frontend Hooks (`frontend/src/hooks/api/`)

- [ ] Create `use{Integration}Integrations.ts` hook
- [ ] Use SWR pattern with invalidation key
- [ ] Follow pattern from `usePosthogIntegrations.ts` or similar

#### 10. Frontend Invalidation Keys (`frontend/src/shared/InvalidationKeys.ts`)

- [ ] Add `{integration}IntegrationsKey()` function
- [ ] Follow pattern: `return ['{integration}Integrations'] as const;`

#### 11. Frontend Components

- [ ] **Integration Card** (`frontend/src/components/Integrations/IntegrationCard.tsx`):
  - Add case to switch statement
  - Return component or `null` if not needed
- [ ] **Integration Card Component** (`frontend/src/components/Integrations/{Integration}IntegrationCard.tsx`):
  - Create dedicated integration card component (if needed)
  - Follow pattern from `PosthogIntegrationCard.tsx` or similar
  - Include form for connecting/updating API key (if form-based auth)
  - Display list of connected integrations
  - **Show human-readable names** (e.g., token names, workspace names) - never show IDs to users
  - Show loading states with skeletons
  - Handle errors appropriately
  - Use appropriate icon (from lucide-react or custom)
  - Add tooltip with link to API keys page (if applicable)
  - Import and use in `IntegrationCard.tsx`
- [ ] **Knowledge Base Selector** (`frontend/src/pages/Agents/components/KnowledgeBaseSelector.tsx`):
  - Add case for new config type
  - Render knowledge base integration component
- [ ] **Knowledge Base Integration Component** (`frontend/src/pages/Agents/components/`):
  - Create component for configuring knowledge base
  - Handle API key input (if form-based)
  - **Query API for selectable options** (e.g., projects, environments, workspaces) - use Select dropdowns instead of text inputs
  - **Never expect users to know IDs or keys** - fetch them from the API and present as selectable options
  - Handle config fields with Select components populated from API responses
  - Call `setConfig()` when fields change

#### 12. Frontend Config Utils (`frontend/src/utility/ConfigUtils.ts`)

**CRITICAL: This is commonly missed!**

- [ ] Import new `Config` class
- [ ] Add case to `deserializeConfig()` switch statement
- [ ] Instantiate config class with proper parameters

#### 13. Frontend Icons (`frontend/src/components/icons/IntegrationIcons.tsx`)

- [ ] Add icon component (SVG or image)
- [ ] Update `IconForConfigType` switch (if knowledge base)
- [ ] Update `IconForIntegration` switch
- [ ] If using image, ensure file exists in `public/` directory

#### 14. Frontend Integration Mapping (`frontend/src/pages/Agents/components/Integration.tsx`)

- [ ] Add case to `IconForConfigType` switch
- [ ] Add case to `IconForIntegration` switch

### Verification Steps

After completing all steps, **always run these verification commands**:

```bash
# 1. Copy shared types (if you modified shared/)
node scripts/copy-shared.js

# 2. Generate Prisma client (if you modified schema)
cd backend && pnpm exec prisma generate

# 3. Build backend
cd backend && pnpm run build

# 4. Build frontend
cd frontend && pnpm run build
```

**Do not skip the build steps!** They catch type errors that would otherwise cause runtime failures.

### Common Mistakes to Avoid

1. ❌ **Forgetting type converters** - All 4 integration type converters + knowledge base converters must be updated
2. ❌ **Skipping `copy-shared.js`** - Shared types must be copied after modification
3. ❌ **Skipping Prisma generate** - Prisma client must be regenerated after schema changes
4. ❌ **Missing ConfigUtils deserialization** - Frontend needs to deserialize configs from JSON
5. ❌ **Missing IntegrationCard case** - Even if returning `null`, the case must exist
6. ❌ **Missing Integration Card Component** - For form-based integrations (API key auth), create a dedicated integration card component following the `PosthogIntegrationCard.tsx` pattern. Include form handling, loading states, error handling, and integration display.
7. ❌ **Missing invalidation key** - SWR hooks need invalidation keys
8. ❌ **Not running builds** - Always build both frontend and backend to catch errors
9. ❌ **Missing Prisma types update** - `ChannelKnowledgeBaseWithConfigs` must include new config type
10. ❌ **Not returning actions** - All tools must return actions in the `actions` array of their return value
11. ❌ **Not following existing patterns** - Study PostHog/GitHub implementations first
12. ❌ **Expecting users to type IDs or keys** - Always query the API and present selectable options (e.g., projects, environments) in Select dropdowns instead of text inputs
13. ❌ **Showing IDs to users** - Always show human-readable names (token names, workspace names, project names) instead of integration IDs or database IDs
14. ❌ **Missing Prisma config include** - For knowledge bases, must add `{integration}_config: true` to `getKnowledgeBaseConfigInclude()` in `prismaIncludes.ts`, otherwise channels will fail to load with "Unsupported knowledge base config type" errors

### Key Reminders

- **Tool descriptions should be concise** - Single-line descriptions for agent tools
- **Avoid repetition between tools and system prompts** - Tool descriptions are already available to the LLM, so system instructions should focus on workflow/strategy, not re-describe tools
- **Always return actions** - Every successful tool execution must return actions in the `actions` array of the return value
- **Create session-specific types** - Knowledge bases need custom session interfaces (e.g., `LaunchDarklyKnowledgeBaseSession`)
- **Icons can be images** - Use JPEG/PNG in `public/` if SVG isn't available
- **Type safety is critical** - TypeScript exhaustive checks will catch missing cases

## Tool Name and Write Approval Validation

When creating or modifying tools in the Terse codebase, you **MUST** comply with the following server-side validation checks. These validations run at server startup and will prevent the application from starting if violated.

### Tool Name Requirements

1. **All tool names must be defined in the ToolName enum**
   - Location: `backend/src/tools/ToolNames.ts`
   - Every tool's `name` property must use a value from the `ToolName` enum
   - If you need a new tool name, you MUST add it to the enum first
   - The validation function `validateAllToolNames()` will throw an error if any tool uses a name not in the enum

2. **Tool names must be unique across all outputs and knowledge bases**
   - No two tools (across any output or knowledge base) can have the same name
   - The validation will detect duplicates and prevent server startup
   - If you need to reuse functionality, consider creating separate tools with distinct names

### Write Tool Approval Requirements

3. **All write tools (non-read-only) must have a `needsApproval` function**
   - Write tools are tools where `isReadOnly === false`
   - Every write tool MUST define a `needsApproval` function that determines if the tool requires approval
   - Use `createNeedsApprovalFunction(ToolName.X)` helper to create the approval function
   - The validation function `validateWriteToolsHaveNeedsApproval()` will throw an error if any write tool is missing this function

### Validation Location

These validations are enforced in:
- `backend/src/tools/validateToolNames.ts`
- Called at server startup via `runStartupValidations()`

### What NOT to Do

❌ **DO NOT** create tools with names not in the ToolName enum  
❌ **DO NOT** create duplicate tool names across different outputs/knowledge bases  
❌ **DO NOT** create write tools without a `needsApproval` function  
❌ **DO NOT** bypass these validations - they are critical for system integrity

### What TO Do

✅ **DO** add new tool names to `ToolName` enum before using them  
✅ **DO** ensure all tool names are unique  
✅ **DO** add `needsApproval` function to all write tools using `createNeedsApprovalFunction()`  
✅ **DO** run the server locally to verify validations pass before committing

## Formatting Rules

**All code must follow Prettier as configured in `.prettierrc`.** CI runs `pnpm run format:check` in both backend and frontend; PRs must pass.

### Prettier (source of truth: `.prettierrc`)

- **Semicolons**: none (`semi: false`)
- **Quotes**: double for strings (`singleQuote: false`)
- **Indentation**: 4 spaces (`tabWidth: 4`)
- **Trailing commas**: none (`trailingComma: "none"`)
- **Print width**: 200 (`printWidth: 200`)
- **Arrow functions**: omit parens when single param (`arrowParens: "avoid"`)
- **Line endings**: LF (`endOfLine: "lf"`)

### Import order

Imports are sorted by the `@trivago/prettier-plugin-sort-imports` plugin. Order:

1. `react`
2. Third-party modules
3. `@/` aliases
4. Relative `../`
5. Relative `./`

Use `importOrderSeparation: true` (blank line between groups). Sort specifiers within each import.

### Before committing

Run format so CI passes:

```bash
# In /backend and /frontend
pnpm run format
# or
pnpm run format:check   # fails if not formatted
```

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

1. ❌ Code that fails `pnpm run format:check`—follow Prettier (see **Formatting Rules** above)
2. ❌ `useCallback` in frontend code
3. ❌ Excessive comments—code should be self-documenting
4. ❌ JSDoc comments
5. ❌ JavaScript files—TypeScript only
6. ❌ Direct API calls without using `BackendProvider`
7. ❌ Inline styles or CSS files—use Tailwind only
8. ❌ Skipping `pnpm run build` validation before committing
9. ❌ Using npm or yarn instead of pnpm
10. ❌ Stray strings allowed UNLESS absolutely necessary (e.g., `const tokenType = authed_user?.token_type || 'user';` where `'user'` is outputted from an API and could be an enum type)
11. ❌ Defining variables as `false` or `true` where you could just use a not operator (e.g., `const actualIsBotUser = isUserType && authed_user.access_token ? false : true;` should be `const actualIsBotUser = !(isUserType && authed_user.access_token);`)
12. ❌ Non-exhaustive maps—when defining maps, ensure they're exhaustive using TypeScript's type system (see `shared/Configs.ts` lines 401-427 for an example with `ConfigMetadataMap`)

## URL and Socket Event Standards

**CRITICAL: Always use centralized constants for URLs and socket events. Never use magic strings.**

### API Routes

All backend API routes must use constants from `shared/ApiRoutes.ts`:

- **Backend route definitions**: Use `.pattern` for Express routes
  ```typescript
  app.get(ApiRoutes.AGENTS.BY_ID.pattern, authMiddleware, handler);
  ```

- **Frontend API calls**: Use `.build(...)` for actual URLs
  ```typescript
  axios.get(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`);
  ```

- **Dynamic routes**: Use route objects with both `pattern` and `build` functions
  ```typescript
  ApiRoutes.AGENTS.BY_ID.pattern  // '/agents/:id' for Express
  ApiRoutes.AGENTS.BY_ID.build(id)  // '/agents/123' for actual URL
  ```

### Frontend Routes

All frontend routes must use constants from `shared/FrontendRoutes.ts`:

- **React Router definitions**: Use route constants
  ```typescript
  <Route path={FrontendRoutes.AGENTS.BY_ID.pattern} element={<AgentDetail />} />
  ```

- **Navigation calls**: Use route builders
  ```typescript
  navigate(FrontendRoutes.AGENTS.DETAIL(agentId));
  ```

- **Deep links in backend**: Combine with `urls.frontend`
  ```typescript
  const link = `${urls.frontend}${FrontendRoutes.AGENTS.RUN_HISTORY(agentId, runId)}`;
  ```

### Socket Events

All socket event names must use constants from `shared/SocketEvents.ts`:

- **Event names**: Use `SocketEvents` constants
  ```typescript
  socket.on(SocketEvents.AGENT_CHAT_EVENT, handler);
  socket.emit(SocketEvents.AGENT_CHAT_MESSAGE, payload);
  ```

- **Socket rooms**: Use `SocketRooms` helpers
  ```typescript
  io.to(SocketRooms.user(userId)).emit(SocketEvents.INVALIDATE, { key });
  ```

### OAuth Redirects

OAuth redirect URLs must use `FrontendRoutes`:

```typescript
res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`);
res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
```

### Webhook URLs

Webhook URLs must use `ApiRoutes.WEBHOOKS`:

```typescript
const webhookUrl = `${urls.backend}${ApiRoutes.WEBHOOKS.FIGMA}`;
const webhookUrl = `${urls.backend}${ApiRoutes.WEBHOOKS.SCHEDULE_BY_INPUT_ID.build(inputId)}`;
```

**Why**: This ensures frontend and backend stay in sync, prevents typos, enables easy refactoring, and provides type safety.
