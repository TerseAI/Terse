ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG TERSE_VERSION
ARG DURABLE_OBJECTS_DEPENDENCY_SPEC
ARG PROJECT_DIR=/opt/terse-sdk-run/project
RUN test -n "${TERSE_VERSION}" && test -n "${DURABLE_OBJECTS_DEPENDENCY_SPEC}"

# The npm counterpart of the pnpm image: same scaffold dependency set, in npm's flat layout, at the
# path a deploy builds in. npm reconciles the tree in place rather than rebuilding it, which
# measured 10s of install down to 1.3s and halved the snapshot payload. The two layouts cannot
# share a directory, which is why this is a separate image rather than another layer.
RUN mkdir -p "${PROJECT_DIR}" && cd "${PROJECT_DIR}" \
    && printf '{"name":"terse-baked","private":true,"dependencies":{"little-durable-objects":"%s","terse-sdk":"%s","zod":"^4.3.6"}}' "${DURABLE_OBJECTS_DEPENDENCY_SPEC}" "${TERSE_VERSION}" > package.json \
    && npm install --omit=dev --no-fund --ignore-scripts \
    && rm -f package.json package-lock.json

LABEL org.opencontainers.image.source="https://github.com/TerseAI/Terse" \
      org.opencontainers.image.title="terse-sandbox-node-npm"
