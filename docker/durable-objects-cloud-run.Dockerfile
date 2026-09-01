FROM rust:1.89.0-bookworm AS runtime-builder

WORKDIR /build
COPY --from=durable_objects_source Cargo.toml Cargo.lock build.rs ./
COPY --from=durable_objects_source .cargo ./.cargo
COPY --from=durable_objects_source proto ./proto
COPY --from=durable_objects_source src ./src
RUN cargo build --locked --release

FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732 AS provider-builder

WORKDIR /build
RUN corepack enable
COPY --from=durable_objects_source package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=durable_objects_source npm ./npm
RUN pnpm install --frozen-lockfile --filter @terse/durable-objects... \
    && pnpm --dir npm build \
    && pnpm --filter @terse/durable-objects deploy --prod --legacy /runtime/npm

FROM node:22.22.3-slim@sha256:7af03b14a13c8cdd38e45058fd957bf00a72bbe17feac43b1c15a689c029c732

RUN apt-get -o Acquire::Retries=3 update -qq \
    && DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 install -y -qq --no-install-recommends \
        ca-certificates \
        libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=runtime-builder /build/target/release/durable-object-runtime /usr/local/bin/durable-object-runtime
COPY --from=provider-builder --chown=node:node /runtime/npm /opt/durable-objects/npm
RUN chmod 0755 /usr/local/bin/durable-object-runtime /opt/durable-objects/npm/dist/providers/modalCli.js \
    && ln -s /opt/durable-objects/npm/dist/providers/modalCli.js /usr/local/bin/terse-durable-objects-modal

ENV RUST_LOG=warn,durable_object_runtime=info
ENV DURABLE_OBJECT_SANDBOX_COMMAND=terse-durable-objects-modal

EXPOSE 8080
USER node
ENTRYPOINT ["/usr/local/bin/durable-object-runtime"]
