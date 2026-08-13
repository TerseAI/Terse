FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

ARG TERSE_VERSION
ARG PNPM_VERSION=10.34.1
RUN test -n "${TERSE_VERSION}"

ENV TERSE_SANDBOX_RELEASE=${TERSE_VERSION}
ENV TERSE_CLI_CACHE_PATH=/opt/terse-sdk-cache/cli

# Install the base dependencies
RUN apt-get -o Acquire::Retries=3 update -qq \
    && DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 install -y -qq --no-install-recommends \
        ca-certificates \
        curl \
        git \
        unzip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --force --no-fund "pnpm@${PNPM_VERSION}"

# Install the Terse CLI. We install it fully here because we have to run 
RUN mkdir -p "${TERSE_CLI_CACHE_PATH}" \
    && npm install -g --prefix "${TERSE_CLI_CACHE_PATH}" --no-fund "terse-cli@${TERSE_VERSION}" \
    && printf '%s' "${TERSE_VERSION}" > "${TERSE_CLI_CACHE_PATH}/.terse-cli-version"

# Warm the npm cache with the SDK's whole dependency tree, have to install the SDK into a throwaway project
# because adding to npm cache only fetches the SDK's tarball. The SDK isn't actually installed because
# the actual version is dictated by the user's project.
RUN mkdir -p /tmp/warm && cd /tmp/warm \
    && npm init -y > /dev/null \
    && npm install --omit=dev --no-fund --ignore-scripts "terse-sdk@${TERSE_VERSION}" \
    && cd / && rm -rf /tmp/warm

# Warm the pnpm cache with the SDK AND CLIs whole dependency tree
# pnpm needs the same treatment for the same reason: `pnpm store add` fetches the named package
# and nothing it depends on, which left the store at 296KB against 184MB for the real tree, and
# an install reusing 1 of 452 packages. A real install fills it: 5.3s cold -> 1.8s warm.
RUN mkdir -p /tmp/warm-pnpm && cd /tmp/warm-pnpm \
    && pnpm init > /dev/null \
    && pnpm add --prod --ignore-scripts --config.confirmModulesPurge=false "terse-sdk@${TERSE_VERSION}" \
    && cd / && rm -rf /tmp/warm-pnpm

# The scaffold's dependency set, installed at the path a deploy builds in. A warm store still made
# every deploy copy ~190MB out of it, because pnpm cannot hardlink across overlay layers, and those
# same bytes then had to be snapshotted. Materializing the tree in this layer instead means a
# matching project has nothing to install and contributes nothing to the snapshot: measured 232MB
# of snapshot payload down to 459KB, and the install from 5.5s to 1.2s ("Already up to date").
#
# A project with different dependencies is not penalised: pnpm reconciles, so it pays only its own
# delta, and npm projects wipe the tree with a cheap whiteout as they always did.
ARG WORKFLOW_VERSION
ARG PROJECT_DIR=/opt/terse-sdk-run/project
RUN test -n "${WORKFLOW_VERSION}" \
    && mkdir -p "${PROJECT_DIR}" && cd "${PROJECT_DIR}" \
    && printf '{"name":"terse-baked","private":true,"dependencies":{"terse-sdk":"%s","workflow":"%s","zod":"^4.3.6"}}' "${TERSE_VERSION}" "${WORKFLOW_VERSION}" > package.json \
    && pnpm install --prod --ignore-scripts --config.confirmModulesPurge=false \
    && rm -f package.json pnpm-lock.yaml

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-node"
