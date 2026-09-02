ARG DURABLE_OBJECTS_VERSION
FROM us-central1-docker.pkg.dev/fluid-analogy-473415-c2/public/little-durable-objects:${DURABLE_OBJECTS_VERSION} AS durable-object-runtime

FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS durable-object-package-builder

ARG DURABLE_OBJECTS_VERSION
RUN mkdir -p /artifacts \
    && npm pack "little-durable-objects@${DURABLE_OBJECTS_VERSION}" --pack-destination /artifacts \
    && mv /artifacts/little-durable-objects-*.tgz /artifacts/little-durable-objects.tgz

FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

ARG TERSE_VERSION
ARG PNPM_VERSION=10.34.1
RUN test -n "${TERSE_VERSION}"

ENV TERSE_SANDBOX_RELEASE=${TERSE_VERSION}
ENV TERSE_CLI_CACHE_PATH=/opt/terse-sdk-cache/cli
ENV DURABLE_OBJECTS_PACKAGE_TARBALL=/opt/terse-sdk-cache/packages/little-durable-objects.tgz

# Install the base dependencies
RUN apt-get -o Acquire::Retries=3 update -qq \
    && DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 install -y -qq --no-install-recommends \
        ca-certificates \
        curl \
        git \
        libssl3 \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Both package managers ship, because a project can pin either one.
RUN npm install -g --force --no-fund "pnpm@${PNPM_VERSION}"

COPY --from=durable-object-runtime /usr/local/bin/little-durable-objects /usr/local/bin/little-durable-objects
COPY --from=durable-object-package-builder /artifacts/little-durable-objects.tgz ${DURABLE_OBJECTS_PACKAGE_TARBALL}
RUN test -x /usr/local/bin/little-durable-objects && test -s "${DURABLE_OBJECTS_PACKAGE_TARBALL}"

# Install the Terse CLI. We install it fully here because we have to run
RUN mkdir -p "${TERSE_CLI_CACHE_PATH}" \
    && npm install -g --prefix "${TERSE_CLI_CACHE_PATH}" --no-fund "terse-cli@${TERSE_VERSION}" \
    && printf '%s' "${TERSE_VERSION}" > "${TERSE_CLI_CACHE_PATH}/.terse-cli-version"

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-base"
