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

# Warm the npm cache with the SDK's whole dependency tree
RUN mkdir -p /tmp/warm && cd /tmp/warm \
    && npm init -y > /dev/null \
    && npm install --omit=dev --no-fund --ignore-scripts "terse-sdk@${TERSE_VERSION}" \
    && cd / && rm -rf /tmp/warm

# Warm the pnpm cache with the SDK AND CLIs whole dependency tree
RUN mkdir -p /tmp/warm-pnpm && cd /tmp/warm-pnpm \
    && pnpm init > /dev/null \
    && pnpm add --prod --ignore-scripts --config.confirmModulesPurge=false "terse-sdk@${TERSE_VERSION}" \
    && cd / && rm -rf /tmp/warm-pnpm

ARG WORKFLOW_VERSION
ARG PROJECT_DIR=/opt/terse-sdk-run/project
RUN test -n "${WORKFLOW_VERSION}" \
    && mkdir -p "${PROJECT_DIR}" && cd "${PROJECT_DIR}" \
    && printf '{"name":"terse-baked","private":true,"dependencies":{"terse-sdk":"%s","workflow":"%s","zod":"^4.3.6"}}' "${TERSE_VERSION}" "${WORKFLOW_VERSION}" > package.json \
    && pnpm install --prod --ignore-scripts --config.confirmModulesPurge=false \
    && rm -f package.json pnpm-lock.yaml

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-node"
