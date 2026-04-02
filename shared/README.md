#"terse-types"

Shared Terse TypeScript types, enums, constants, and helpers packaged for reuse across repositories.

## Install

```bash
npm install"terse-types"
```

```bash
pnpm add"terse-types"
```

## Usage

Import from the root barrel when you want the common API surface:

```ts
import { IntegrationType, type User } from "terse-types"
```

Import by subpath when you want a specific module:

```ts
import { ApiRoutes } from "terse-types"
import type { RunHistoryStatus } from "terse-types"
```

## Local Development

The `shared/` directory remains the source of truth for this repo. Current in-repo consumers still use the existing copy workflow:

```bash
npm run sync:shared
```

Build the publishable package from the repo root:

```bash
npm run build:shared
```

Preview the package contents:

```bash
npm run pack:shared
```

## Release Workflow

Bump the package version from the repo root:

```bash
npm run version:shared:patch
```

You can also use `version:shared:minor` or `version:shared:major`.

Publish the package:

```bash
npm run publish:shared
```
