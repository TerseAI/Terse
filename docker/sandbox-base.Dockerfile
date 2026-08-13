# Utilities every SDK sandbox needs, so a deploy never pays for apt at build time.
# Published per release as terse-sandbox-base:<version>; nothing in here is
# version-specific, but it is tagged with the release so a runtime image and its
# base are always inspectable as a pair.
FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

ARG PNPM_VERSION=10.34.1

RUN apt-get -o Acquire::Retries=3 update -qq \
    && DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 install -y -qq --no-install-recommends \
        ca-certificates \
        curl \
        git \
        tini \
        unzip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g --force --no-fund "pnpm@${PNPM_VERSION}" \
    && npm cache clean --force

ENV TERSE_SANDBOX_PNPM_VERSION=${PNPM_VERSION}

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-base"
