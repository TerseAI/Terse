# terse-types

Internal shared types for the [Terse](https://useterse.ai) platform.

## You probably don't want to be here

`terse-types` is a workspace package that the Terse backend, frontend, CLI, and SDK use to share TypeScript types. It is not the public API.

If you landed here while building a workflow, you almost certainly want one of these instead:

- **[`terse-cli`](https://www.npmjs.com/package/terse-cli)** to scaffold, test, and deploy workflows
- **[`terse-sdk`](https://www.npmjs.com/package/terse-sdk)** to write workflow code (`createJob`, `TerseAgent`, trigger types)
- **[docs.useterse.ai](https://docs.useterse.ai)** for guides and reference

If a doc, post, or LLM pointed you at `terse-types` directly, that was probably a mistake on our end. [Let us know](mailto:support@useterse.ai) so we can fix it. The types you actually need are re-exported from `terse-sdk`.

## If you really do need it

Anything in `terse-types` is internal and may change without notice. There is no stability guarantee, no migration guide, and no semver discipline beyond what the workspace happens to need.

```bash
pnpm add terse-types
```

```ts
import { IntegrationType, type User } from "terse-types"
```

## Local development

```bash
pnpm --filter terse-types run build
```

If you are working on the local CLI and SDK at the same time, relink everything from the repo root:

```bash
pnpm run install-global
```
