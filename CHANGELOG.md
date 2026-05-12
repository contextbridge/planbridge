# Changelog

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
