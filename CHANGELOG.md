# Changelog

## [0.9.2](https://github.com/contextbridge/planbridge/compare/v0.9.1...v0.9.2) (2026-06-17)


### Bug Fixes

* stop draft typing from resyncing highlights ([#225](https://github.com/contextbridge/planbridge/issues/225)) ([66fa710](https://github.com/contextbridge/planbridge/commit/66fa710d82d496f79440a76763d9042ceff9d2d3))

## [0.9.1](https://github.com/contextbridge/planbridge/compare/v0.9.0...v0.9.1) (2026-06-11)


### Bug Fixes

* correct mermaid diagram hover and selected-node styling ([#219](https://github.com/contextbridge/planbridge/issues/219)) ([0323e56](https://github.com/contextbridge/planbridge/commit/0323e56d56d6053814ed67407c69ee1451c479e1))

## [0.9.0](https://github.com/contextbridge/planbridge/compare/v0.8.0...v0.9.0) (2026-06-09)


### Features

* add element annotations with a Mermaid diagram adapter ([#215](https://github.com/contextbridge/planbridge/issues/215)) ([5dbd5cc](https://github.com/contextbridge/planbridge/commit/5dbd5cc796c9d38c6929385680d2e9df0360bb37))
* Keyboard shortcuts for sidebar ([#192](https://github.com/contextbridge/planbridge/issues/192)) ([70cba26](https://github.com/contextbridge/planbridge/commit/70cba26b026f0675c097707f76c1008ecd0ffcce))
* scaffold contextbridge review subcommand and UI ([#196](https://github.com/contextbridge/planbridge/issues/196)) ([b999c1d](https://github.com/contextbridge/planbridge/commit/b999c1d442bd300d06ce78589a0c289d768780cf))


### Bug Fixes

* publish verifiable build provenance for releases ([#207](https://github.com/contextbridge/planbridge/issues/207)) ([3dcd029](https://github.com/contextbridge/planbridge/commit/3dcd029bbe7f28410177d22b942eafba6341a0a5))
* replace empty annotation draft when clicking another element ([#214](https://github.com/contextbridge/planbridge/issues/214)) ([9edd152](https://github.com/contextbridge/planbridge/commit/9edd152fa39c7c9e175fc352e288111f1ae21084))

## [0.8.0](https://github.com/contextbridge/planbridge/compare/v0.7.2...v0.8.0) (2026-05-20)


### Features

* add planbridge-last skill to open the last agent message ([#189](https://github.com/contextbridge/planbridge/issues/189)) ([dbfc615](https://github.com/contextbridge/planbridge/commit/dbfc61548387e18b48e8501f951c2b1ab39f4fb6))


### Bug Fixes

* prevent data loss with onbeforeunload warning ([#188](https://github.com/contextbridge/planbridge/issues/188)) ([ea1f5d5](https://github.com/contextbridge/planbridge/commit/ea1f5d55c0b705ebd7e1ddc59e1832b85d071415))
* render images referenced from the local filesystem ([#165](https://github.com/contextbridge/planbridge/issues/165)) ([bdf98ff](https://github.com/contextbridge/planbridge/commit/bdf98ffdc6d4567630b19d05b9c630333ca45092))

## [0.7.2](https://github.com/contextbridge/planbridge/compare/v0.7.1...v0.7.2) (2026-05-19)


### Bug Fixes

* **annotation:** confirm before discarding draft comments ([#174](https://github.com/contextbridge/planbridge/issues/174)) ([becad44](https://github.com/contextbridge/planbridge/commit/becad446b5b662cdeb84717a5e47dda964ea7a40))
* **cli:** detect Homebrew cask installs on Intel macOS ([#176](https://github.com/contextbridge/planbridge/issues/176)) ([1edd638](https://github.com/contextbridge/planbridge/commit/1edd6381a1ad056e92a67e9895258dfa52331ada))

## [0.7.1](https://github.com/contextbridge/planbridge/compare/v0.7.0...v0.7.1) (2026-05-19)


### Bug Fixes

* clarify sandboxed local server failures ([#167](https://github.com/contextbridge/planbridge/issues/167)) ([c3de712](https://github.com/contextbridge/planbridge/commit/c3de7129ba546121b4fa6eafeb161325debd3a56))
* **website:** typo in website agent instructions copy ([#149](https://github.com/contextbridge/planbridge/issues/149)) ([6c85ebd](https://github.com/contextbridge/planbridge/commit/6c85ebd58eb829a3a5204b20bc0e2f3e91844f5a))

## [0.7.0](https://github.com/contextbridge/planbridge/compare/v0.6.0...v0.7.0) (2026-05-15)


### ⚠ BREAKING CHANGES

* rename Claude Code `/open` skill to `/planbridge-open` for consistency ([#136](https://github.com/contextbridge/planbridge/issues/136))

### Features

* rename Claude Code `/open` skill to `/planbridge-open` for consistency ([#136](https://github.com/contextbridge/planbridge/issues/136)) ([7ca34e3](https://github.com/contextbridge/planbridge/commit/7ca34e3cb40184aaf160b1e3e7cf70f9ab919814)), closes [#133](https://github.com/contextbridge/planbridge/issues/133)
* **website:** adopt Astro 6 best practices (prefetch, image pipeline, Fonts API) ([#129](https://github.com/contextbridge/planbridge/issues/129)) ([ec333e0](https://github.com/contextbridge/planbridge/commit/ec333e0fa2e3804ade787e0bf6497a0d76e77d30))


### Bug Fixes

* clarify Codex Stop hook status message ([#137](https://github.com/contextbridge/planbridge/issues/137)) ([fbcb095](https://github.com/contextbridge/planbridge/commit/fbcb09511bb7fc051f995e2144f047f78e4da927))
* quiet post-update harness refresh ([#128](https://github.com/contextbridge/planbridge/issues/128)) ([e9c5c8e](https://github.com/contextbridge/planbridge/commit/e9c5c8eff5cf3df34d50fe0cc29e802fbf76f81c))

## [0.6.0](https://github.com/contextbridge/planbridge/compare/v0.5.0...v0.6.0) (2026-05-14)


### Features

* add global feedback submit shortcut ([#116](https://github.com/contextbridge/planbridge/issues/116)) ([21b14a1](https://github.com/contextbridge/planbridge/commit/21b14a1dcc29e04c0b36b82e96aa90869f450237))
* allow configuring PlanBridge port ([#95](https://github.com/contextbridge/planbridge/issues/95)) ([bf53148](https://github.com/contextbridge/planbridge/commit/bf5314828e0f369c7a2618a7b1ce755642604f17))
* tell Codex to run contextbridge open outside the sandbox ([#115](https://github.com/contextbridge/planbridge/issues/115)) ([6cff1e9](https://github.com/contextbridge/planbridge/commit/6cff1e90373068b3dda87d982394695dd3580804))

## [0.5.0](https://github.com/contextbridge/planbridge/compare/v0.4.0...v0.5.0) (2026-05-13)

The big news with 0.5.0 is the addition of the `contextbridge open` command. With this command, you can use the PlanBridge UI to markup
any file or content. We also shipped Claude (`/planbridge:open`) and Codex (`$planbridge-open`) skills to make it easy to trigger directly
from your TUI.

This means you can do cool things like:

- Review and annotate [`superpowers`](https://github.com/obra/superpowers) plans:
  ```
  /planbridge:open docs/superpowers/plans/2026-05-12-open-command.md
  ```

- Review and annotate something the agent said (e.g., if it proposed a commit message):
  ```
  /planbridge:open the proposed commit message
  ```

We've got lots more features coming soon that will build on this foundation!

Learn more about the `contextbridge open` command [on the docs site](https://plan.contextbridge.ai/usage/open/).

### Features

* add 'contextbridge open' subcommand and planbridge-open skill ([#83](https://github.com/contextbridge/planbridge/issues/83)) ([0d1854f](https://github.com/contextbridge/planbridge/commit/0d1854f1d128cfb3c408e65171b72dd05552c4a2))
* align prompt reviewer noun with LLM user/assistant parlance ([#89](https://github.com/contextbridge/planbridge/issues/89)) ([ccf1bd1](https://github.com/contextbridge/planbridge/commit/ccf1bd1105c2781fe84faed8d70ccf90ee6d4afc))
* **storage:** Add SQLite DB for local-only storage to support future features like plan diff and  git diff.  ([#96](https://github.com/contextbridge/planbridge/issues/96)) ([b80fdfb](https://github.com/contextbridge/planbridge/commit/b80fdfb8b3bf31f37d2884caaf0fc57b1063ae00))


### Bug Fixes

* let plain link clicks navigate instead of opening the annotation popover ([#92](https://github.com/contextbridge/planbridge/issues/92)) ([28245a1](https://github.com/contextbridge/planbridge/commit/28245a11adbe13e522bffdab45d9e32be7f0690a))
* stop disabling deprecated codex_hooks feature flag ([#104](https://github.com/contextbridge/planbridge/issues/104)) ([74038f0](https://github.com/contextbridge/planbridge/commit/74038f088f8d59f2fcaed0f21f1167c650be825a))

## [0.4.0](https://github.com/contextbridge/planbridge/compare/v0.3.0...v0.4.0) (2026-05-11)


### ⚠ BREAKING CHANGES

Codex recently changed their experimental hooks flag in 0.129.0. In PlanBridge v0.4.0, you must use Codex v0.129.0+.

* compatibility with Codex 0.129.0+ ([#65](https://github.com/contextbridge/planbridge/issues/65))

### Features

* add feedback button to plan UI header (PLAN-7) ([#69](https://github.com/contextbridge/planbridge/issues/69)) ([082cb0b](https://github.com/contextbridge/planbridge/commit/082cb0bafe7778cba9b3bcbb891f4255704162bd))
* clarify Codex implementation handoff after plan approval (PLAN-21) ([#67](https://github.com/contextbridge/planbridge/issues/67)) ([ea723d6](https://github.com/contextbridge/planbridge/commit/ea723d6ef5b14427a9988033142cff3d2188ab5b))


### Bug Fixes

* compatibility with Codex 0.129.0+ ([#65](https://github.com/contextbridge/planbridge/issues/65)) ([410fac1](https://github.com/contextbridge/planbridge/commit/410fac17f7dab35311607c9be8b0099f50de2cff))
* disable telemetry in CI ([#73](https://github.com/contextbridge/planbridge/issues/73)) ([d00fd6d](https://github.com/contextbridge/planbridge/commit/d00fd6dc9d2414b6418ad0bfb8429260eccad679))
* disambiguate install status wording (PLAN-26) ([#78](https://github.com/contextbridge/planbridge/issues/78)) ([48c7852](https://github.com/contextbridge/planbridge/commit/48c7852d4118f4c73448a63313e67b7e66020add)), closes [#77](https://github.com/contextbridge/planbridge/issues/77)

## [0.3.0](https://github.com/contextbridge/planbridge/compare/v0.2.0...v0.3.0) (2026-05-08)


### ⚠ BREAKING CHANGES

Our Claude Plugin was moved into this repo and renamed `planbridge@contextbridge` (from `cli@contextbridge`).
On the next release after 0.3.0, the plugin will be updated automatically, so you shouldn't need to do anything manually. If you want to update immediately, run `contextbridge install claude`.

* rename Claude plugin to planbridge@contextbridge; refresh plugins on update ([#52](https://github.com/contextbridge/planbridge/issues/52))

### Features

* add automatic release changelog with release-please ([#21](https://github.com/contextbridge/planbridge/issues/21)) ([45a1bf1](https://github.com/contextbridge/planbridge/commit/45a1bf127a21e2345fda08f450b1e5c55d8fb55f))
* rename Claude plugin to planbridge@contextbridge; refresh plugins on update ([#52](https://github.com/contextbridge/planbridge/issues/52)) ([2794ae6](https://github.com/contextbridge/planbridge/commit/2794ae6bcc907abf6d81b3ee86031369c424aa4e))
* **ui:** add GitHub link to header help menu ([#19](https://github.com/contextbridge/planbridge/issues/19)) ([c36289b](https://github.com/contextbridge/planbridge/commit/c36289b09158bf07ca371df7616269eba5a3fab6))


### Bug Fixes

* emit plan review analytics from shared runner ([#48](https://github.com/contextbridge/planbridge/issues/48)) ([5c769ff](https://github.com/contextbridge/planbridge/commit/5c769ff9724ed406dbf8b76a835b644d6895fd30))
* refresh Claude marketplace cache during install ([#62](https://github.com/contextbridge/planbridge/issues/62)) ([58be09a](https://github.com/contextbridge/planbridge/commit/58be09a2b601228dcf23fac16da81369ab7b59cb))
* resolve contextbridge via PATH for post-update refresh ([#64](https://github.com/contextbridge/planbridge/issues/64)) ([f658af4](https://github.com/contextbridge/planbridge/commit/f658af4e109f61f9e12ed6c55bb73eb129abe437))
