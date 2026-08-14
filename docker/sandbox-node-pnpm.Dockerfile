ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG TERSE_VERSION
ARG WORKFLOW_CORE_VERSION
ARG PROJECT_DIR=/opt/terse-sdk-run/project
RUN test -n "${TERSE_VERSION}" && test -n "${WORKFLOW_CORE_VERSION}"

# Warm the pnpm store so a project whose dependencies differ from the scaffold still installs
# from disk instead of the registry.
RUN mkdir -p /tmp/warm-pnpm && cd /tmp/warm-pnpm \
    && pnpm init > /dev/null \
    && pnpm add --prod --ignore-scripts --config.confirmModulesPurge=false "terse-sdk@${TERSE_VERSION}" \
    && cd / && rm -rf /tmp/warm-pnpm

# The scaffold's dependency set, materialized at the path a deploy builds in. A warm store alone
# still made every deploy copy ~190MB out of it, because pnpm cannot hardlink across overlay
# layers, and those same bytes then had to be snapshotted. Materializing the tree here means a
# matching project has nothing to install and contributes nothing to the snapshot: measured 232MB
# of snapshot payload down to 459KB, and the install from 5.5s to 1.2s ("Already up to date").
RUN mkdir -p "${PROJECT_DIR}" && cd "${PROJECT_DIR}" \
    && printf '{"name":"terse-baked","private":true,"dependencies":{"terse-sdk":"%s","@workflow/core":"%s","zod":"^4.3.6"}}' "${TERSE_VERSION}" "${WORKFLOW_CORE_VERSION}" > package.json \
    && pnpm install --prod --ignore-scripts --config.confirmModulesPurge=false \
    && rm -f package.json pnpm-lock.yaml

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-node-pnpm"
