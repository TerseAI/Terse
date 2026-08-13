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

# Install the Terse CLI
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
RUN pnpm store add "terse-sdk@${TERSE_VERSION}" "terse-cli@${TERSE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-node"
