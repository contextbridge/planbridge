# Context Interfaces and Fakes

- **Context dependencies should have a public contract and separate implementations.** When adding an injectable dependency to a context (`BaseContext`, `CliContext`, `ServerContext`, `FrontendContext`, or a package-specific context), define a narrow public interface for the behavior the context exposes.

- **Name the production implementation `XxxImpl`.** The real implementation should implement the public interface and carry environment-specific behavior, external API calls, filesystem access, browser effects, or other side effects. Context fields should be typed as the interface, not the concrete implementation.

- **Name the test implementation `FakeXxx`.** Shared test helpers should implement the same public interface with deterministic, inspectable behavior. Keep fakes focused on the interface contract so tests can swap them in without casts, module mocking, or duplicating production implementation details.
