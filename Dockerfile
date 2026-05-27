# Single image shared by backend and frontend services. Installs workspace deps
# and generates the Prisma clients backend needs at runtime. Run command and env
# are the responsibility of docker-compose.
# openssl is required by Prisma engines on alpine (musl libc).
FROM node:20-alpine

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /workspace

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter terse-types build
RUN pnpm --filter backend run db:generate

EXPOSE 3001 5173
