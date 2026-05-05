# Dev-container image for ContextBridge agents.
#
# - The repo is cloned and mounted at runtime — do not COPY source in
# - `/workspace/repo` must be writable by the non-root `bun` user
# - The cb-bot agent task overrides this image's entrypoint with the staged
#   protocol script at /workspace/agent/customer-entrypoint.sh, so this image
#   intentionally has no ENTRYPOINT/CMD of its own

FROM oven/bun:1.3.13-debian
ARG JUST_VERSION=1.49.0
ARG AGENT_UID=1000
ARG AGENT_GID=1000

USER root
RUN groupmod -g "${AGENT_GID}" bun \
  && usermod -u "${AGENT_UID}" -g "${AGENT_GID}" bun \
  && chown -R "${AGENT_UID}:${AGENT_GID}" /home/bun

# nodejs is required so `bun run vitest` resolves vitest's `#!/usr/bin/env node`
# shebang to a real Node — under Bun's runtime, vitest browser mode hangs silently
# before any tests run. Chromium runtime libs are for Playwright (drives
# @contextbridge/plan's vitest --browser tests).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    nodejs \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-$(uname -m)-unknown-linux-musl.tar.gz" \
    | tar -xz -C /usr/local/bin just

RUN mkdir -p /workspace/repo && chown -R bun:bun /workspace

USER bun
ENV HOME=/home/bun
WORKDIR /workspace
