export {
  type ClaudeStateFixture,
  type MarketplaceFixture,
  type PluginFixture,
  marketplaceListResult,
  pluginListResult,
  primeClaudeShellouts,
  stubClaudeState,
} from './claudeInstallerFakes.ts';
export { type CommandStub, type FakeCommandCall, FakeCommandRunner } from './FakeCommandRunner.ts';
export { FakeIo } from './FakeIo.ts';
export { FakePrompter } from './FakePrompter.ts';
export { FakeUpdater } from './FakeUpdater.ts';
export { MemoryStream } from './MemoryStream.ts';
export { type TestContext, createStubContext } from './createStubContext.ts';
export { parseStdoutJson } from './parseStdoutJson.ts';
export { createAnnotationDependencies, type TrackedAnnotationDependencies } from './annotationFakes.ts';
export { type LogRecord, readErrorLogs, readLogs, readWarnLogs } from './readLogs.ts';
export { expectErr, expectOk, expectOkValue } from './resultAssertions.ts';
