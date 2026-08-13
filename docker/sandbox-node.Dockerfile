# Node SDK sandbox image. There is one of these, consumed through a moving tag, not one per
# release: its value is the warm package cache for the Terse dependency tree, and that tree is
# near-identical across releases (adding a whole release to a warm cache measures at ~1MB).
#
# It bakes this release's CLI so current deploys skip the install entirely, and warms the package
# cache for this release. Older CLIs are not warmed on purpose: their trees overlap this one so
# heavily that they install warm anyway (measured: 4.02s against a cache warmed with a different
# release, versus 3.98s fully cached and 13.5s cold).
#
# Paths below must match ModalSandboxService.getCliCachePath.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG TERSE_VERSION
RUN test -n "${TERSE_VERSION}"

ENV TERSE_SANDBOX_RELEASE=${TERSE_VERSION}
ENV TERSE_CLI_CACHE_PATH=/opt/terse-sdk-cache/cli

# The baked CLI. The marker is what a build compares against to decide whether to install.
RUN mkdir -p "${TERSE_CLI_CACHE_PATH}" \
    && npm install -g --prefix "${TERSE_CLI_CACHE_PATH}" --no-fund "terse-cli@${TERSE_VERSION}" \
    && printf '%s' "${TERSE_VERSION}" > "${TERSE_CLI_CACHE_PATH}/.terse-cli-version"

# Warm the caches rather than a node_modules tree: a deploy with a lockfile runs `npm ci`, which
# wipes node_modules but still reads ~/.npm.
RUN mkdir -p /tmp/warm && cd /tmp/warm \
    && npm init -y > /dev/null \
    && npm install --omit=dev --no-fund "terse-sdk@${TERSE_VERSION}" \
    && cd / && rm -rf /tmp/warm

RUN pnpm store add "terse-sdk@${TERSE_VERSION}" "terse-cli@${TERSE_VERSION}"

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-node"
