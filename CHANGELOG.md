# Changelog

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
