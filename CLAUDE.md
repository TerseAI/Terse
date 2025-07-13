# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend
```bash
cd backend
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm test             # Run tests
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio
```

### Frontend
```bash
cd frontend
npm run dev      # Start Vite development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Root Level
```bash
node scripts/copy-shared.js  # Copy shared types to frontend/backend
```

## Architecture Overview

This is a full-stack TypeScript application that integrates GitHub, Linear, Jira, and Slack to create an automated project management system.

### Key Components

- **Monorepo Structure**: Frontend (React/Vite), Backend (Express/Node.js), and shared types
- **Database**: PostgreSQL with Prisma ORM
- **Integrations**: GitHub App, Linear/Jira APIs, Slack Bot
- **Real-time**: WebSocket connections for agent sessions
- **AI Agent System**: Automated ticket analysis and updates

### Shared Types System

The `/shared/` directory contains TypeScript interfaces used across frontend and backend:
- `TicketSystem.ts`: Core ticket management interfaces
- `types.ts`: Common data types
- `Entities.ts`, `ModelEvents.ts`, `ClientBoundTools.ts`: Agent and event types

The `scripts/copy-shared.js` script synchronizes these types to `backend/src/shared/` and `frontend/src/shared/`. Run this before building either service.

### Database Schema

Key tables managed by Prisma:
- `users`: User accounts with GitHub integration
- `github_repositories`: Connected GitHub repos
- `linear_api_keys`, `jira_api_keys`: Ticket system credentials
- `slack_integrations`: Slack workspace connections
- `activity_events`, `ticket_activity_events`: Event tracking

### Core Systems

#### Agent System (`backend/src/agent/`)
- **Owner**: Main orchestrator that processes GitHub events
- **Analyzer**: AI agent that analyzes commits/PRs and updates tickets
- **Socket**: WebSocket server for real-time agent communication

#### Ticket Integration (`backend/src/ticketing/`)
- Unified interface for Linear and Jira
- Implements shared `TicketManager` interface
- Handles webhook events and ticket synchronization

#### Search System (`backend/src/search/`)
- Vector-based search using pgvector
- Embeds and indexes tickets for semantic search
- Used by Owner to find relevant tickets from commit messages

### Frontend Structure

React application with:
- **Components**: Reusable UI components including chat interface
- **Pages**: Home, Login, LandingPage
- **Context**: Authentication and integrations state management
- **Services**: API communication with backend

### Integration Flow

1. User connects GitHub repo, Linear/Jira workspace, and Slack
2. GitHub webhooks trigger unified events in Owner
3. Owner searches for related tickets using commit/PR content
4. Analyzer agent processes events and updates relevant tickets
5. Results are sent to Slack and logged in activity feed

### Slack Bot Interaction

Users can interact with tickets directly through Slack:
- **DM the bot** for private ticket management
- **Mention the bot** in any channel (`@BotName your message`)
- Uses the same Agent system as GitHub event processing
- Supports natural language commands for:
  - Checking ticket status
  - Updating ticket status
  - Adding comments
  - Creating new tickets
  - Assigning tickets
  - Searching tickets

The bot responds conversationally and provides feedback on actions taken.

## Important Notes

- Always run `npm run db:generate` after schema changes
- Use the shared types system - don't duplicate interfaces
- The Owner uses Linear API keys as fallback if user doesn't have their own
- Vector search requires PostgreSQL with pgvector extension
- WebSocket sessions are stateful and handle agent communication