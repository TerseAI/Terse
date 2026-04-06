# terse-types

Shared Terse TypeScript types, enums, constants, and helpers packaged for reuse across repositories.

## Install

```bash
npm install terse-types
```

```bash
pnpm add terse-types
```

## Usage

Import from the root barrel when you want the common API surface:

```ts
import { IntegrationType, type User } from "terse-types"
```

Import by subpath when you want a specific module:

```ts
import { ApiRoutes } from "terse-types"
import type { RunHistoryStatus } from "terse-types/RunHistoryTypes"
```

## Local Development

The `terse-types` workspace package lives in the repo's `terse-types/` directory.

Build it from the repo root with:

```bash
pnpm --filter terse-types run build
```

If you are working on the local CLI and SDK at the same time, relink them from the repo root with:

```bash
pnpm run install-global
```
