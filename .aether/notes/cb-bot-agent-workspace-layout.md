---
topic: cb-bot-agent-workspace-layout
tags:
  - cb-bot
  - agents
  - docker
  - asdf
updated: '2026-05-15'
---

- cb-bot agent task layout: the customer repo is cloned to `/workspace/repo`, while `/workspace` is a shared task volume containing sibling dirs (`repo`, `handoff`, `agent`, `home`). The customer container sets `HOME=/workspace/home`. Invoking version-manager shims (e.g. asdf `node`) from `/workspace` can fail because neither the checkout `.tool-versions` nor the image user's home config is visible; run repo-tool commands from `/workspace/repo` or explicitly provide tool versions.
