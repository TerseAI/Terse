FROM rust:1.89.0-bookworm AS durable-object-builder

WORKDIR /build
COPY --from=durable_objects_source Cargo.toml Cargo.lock build.rs ./
COPY --from=durable_objects_source .cargo ./.cargo
COPY --from=durable_objects_source proto ./proto
COPY --from=durable_objects_source src ./src
RUN cargo build --locked --release

FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS durable-object-package-builder

WORKDIR /build
RUN corepack enable
COPY --from=durable_objects_source package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=durable_objects_source npm ./npm
RUN pnpm install --frozen-lockfile --filter @terse/durable-objects... \
    && pnpm --dir npm build \
    && mkdir -p /artifacts \
    && pnpm --dir npm pack --out /artifacts/terse-durable-objects.tgz

FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

ARG TERSE_VERSION
ARG PNPM_VERSION=10.34.1
RUN test -n "${TERSE_VERSION}"

ENV TERSE_SANDBOX_RELEASE=${TERSE_VERSION}
ENV TERSE_CLI_CACHE_PATH=/opt/terse-sdk-cache/cli
ENV DURABLE_OBJECTS_PACKAGE_TARBALL=/opt/terse-sdk-cache/packages/terse-durable-objects.tgz

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

COPY --from=durable-object-builder /build/target/release/durable-object-runtime /usr/local/bin/durable-object-runtime
COPY --from=durable-object-package-builder /artifacts/terse-durable-objects.tgz ${DURABLE_OBJECTS_PACKAGE_TARBALL}
RUN test -x /usr/local/bin/durable-object-runtime && test -s "${DURABLE_OBJECTS_PACKAGE_TARBALL}"

# Install the Terse CLI. We install it fully here because we have to run
RUN mkdir -p "${TERSE_CLI_CACHE_PATH}" \
    && npm install -g --prefix "${TERSE_CLI_CACHE_PATH}" --no-fund "terse-cli@${TERSE_VERSION}" \
    && printf '%s' "${TERSE_VERSION}" > "${TERSE_CLI_CACHE_PATH}/.terse-cli-version"

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-base"
