# Infrastructure recipes

_require-tools:
    test -f tools/infrastructure/package.json || (echo "Private tools submodule is not initialized. Run: just tools-init" >&2; exit 1)

# Run infrastructure tests
test: _require-tools
    cd tools/infrastructure && bun test

# Type check without emitting
typecheck: _require-tools
    cd tools/infrastructure && bun run typecheck

# Synthesize CDK stacks (validates templates without deploying)
synth *args: _require-tools
    cd tools/infrastructure && bun run cdk synth {{ args }}

# Diff deployed stack against the local source
diff *args: _require-tools
    cd tools/infrastructure && bun run cdk diff {{ args }}
