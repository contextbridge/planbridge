# Release recipes
# All recipes run from the project root so scripts/ and .goreleaser.yaml resolve correctly.

set working-directory := '..'

# Cut a stable release (creates and pushes a vX.Y.Z tag)
stable increment:
    bun run scripts/releaseStable.ts {{increment}}

# Cut an alpha prerelease (creates and pushes a vX.Y.Z-alpha.N tag)
alpha increment:
    bun run scripts/releaseAlpha.ts {{increment}}

# Build all release artifacts locally without publishing, signing, or notarizing.
# Requires `goreleaser` on PATH (brew install goreleaser/tap/goreleaser).
dry-run:
    goreleaser release --snapshot --clean --skip=publish,sign,notarize
