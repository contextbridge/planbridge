# Dev-container image for ContextBridge agents.
#
# - The repo is cloned and mounted at runtime — do not COPY source in
# - `/workspace/repo` must be writable by the non-root `agent` user
# - The cb-bot agent task overrides this image's entrypoint with the staged
#   protocol script at /workspace/agent/customer-entrypoint.sh, so this image
#   intentionally has no ENTRYPOINT/CMD of its own

FROM debian:bookworm-slim
ARG AGENT_UID=1000
ARG AGENT_GID=1000
ARG ASDF_VERSION=0.18.0
ARG NODE_VERSION=24.15.0

# Chromium runtime libs drive @contextbridge/annotation's vitest --browser tests.
# libdbus-1-3 is required by aether's native ACP subprocess.
# xz-utils unpacks the Node tarball; unzip is needed by the asdf bun plugin.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    unzip \
    xz-utils \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
  && curl -fsSL "https://github.com/asdf-vm/asdf/releases/download/v${ASDF_VERSION}/asdf-v${ASDF_VERSION}-linux-$(dpkg --print-architecture).tar.gz" \
    | tar -xz -C /usr/local/bin asdf \
  && chmod +x /usr/local/bin/asdf \
  && case "$(dpkg --print-architecture)" in \
       amd64) NODE_ARCH=x64 ;; \
       arm64) NODE_ARCH=arm64 ;; \
       *) echo "Unsupported arch: $(dpkg --print-architecture)" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1 --no-same-owner \
      --exclude='*.md' --exclude='LICENSE' \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd -g "${AGENT_GID}" agent \
  && useradd -m -u "${AGENT_UID}" -g "${AGENT_GID}" -s /bin/bash agent \
  && mkdir -p /workspace/repo \
  && chown -R agent:agent /workspace

USER agent
ENV HOME=/home/agent
ENV ASDF_DATA_DIR=/home/agent/.asdf
ENV PATH="/home/agent/.asdf/shims:${PATH}"

COPY --chown=agent:agent .tool-versions /home/agent/.tool-versions
WORKDIR /home/agent
RUN asdf plugin add bun \
  && asdf plugin add just \
  && asdf install \
  && asdf reshim

WORKDIR /workspace
