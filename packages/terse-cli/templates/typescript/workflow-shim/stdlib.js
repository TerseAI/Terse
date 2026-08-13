// Vendored verbatim from workflow@5.0.0-beta.19 dist/stdlib.js. Re-sync when the pinned
// @workflow/core version changes: these are compiled step sources, not a re-export.
/**
 * This is the "standard library" of steps that we make available to all workflow users.
 * The can be imported like so: `import { fetch } from 'workflow'`. and used in workflow.
 * The need to be exported directly in this package and cannot live in `core` to prevent
 * circular dependencies post-compilation.
 */
/**
 * A hoisted `fetch()` function that is executed as a "step" function,
 * for use within workflow functions.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 */
export async function fetch(...args) {
    'use step';
    return globalThis.fetch(...args);
}
