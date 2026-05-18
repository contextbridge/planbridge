import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import { describe, expect, it } from 'bun:test';
import { annotationArgs, environment } from '#src/testFactories.ts';
import { createAnnotationDependencies, createStubContext } from '#src/testHelpers/index.ts';
import { AnnotationEnvironmentError, runAnnotation } from './runAnnotation.ts';

describe('runAnnotation', () => {
  it('opens the browser and returns the submitted review', async () => {
    const openedUrls: string[] = [];
    const { context } = createStubContext({ openUrl: (url) => (openedUrls.push(url), Promise.resolve()) });
    const deps = createAnnotationDependencies();

    const submission = await runAnnotation(context, annotationArgs.build(), deps);

    expect(submission).toEqual(deps.submission);
    expect(openedUrls).toEqual(['http://localhost:4312']);
    expect(deps.payloads).toEqual([
      { content: '# Plan', title: 'Plan', contentKind: 'plan', metadata: { entrypoint: 'plan_command' } },
    ]);
    expect(deps.port).toBeUndefined();
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
  });

  it('uses CONTEXTBRIDGE_PORT when no explicit port is supplied', async () => {
    const { context } = createStubContext({ env: environment.build({ CONTEXTBRIDGE_PORT: 3456 }) });
    const deps = createAnnotationDependencies();

    await runAnnotation(context, annotationArgs.build(), deps);

    expect(deps.port).toBe(3456);
  });

  it('uses the explicit port before CONTEXTBRIDGE_PORT', async () => {
    const { context } = createStubContext({ env: environment.build({ CONTEXTBRIDGE_PORT: 3456 }) });
    const deps = createAnnotationDependencies();

    await runAnnotation(context, annotationArgs.build({ port: 3000 }), deps);

    expect(deps.port).toBe(3000);
  });

  it('captures plan-review lifecycle analytics around a successful review', async () => {
    const { context, analytics } = createStubContext();
    const deps = createAnnotationDependencies();

    await runAnnotation(context, annotationArgs.build(), deps);

    const started = analytics.captures.find((c) => c.event === 'plan_review_started');
    expect(started).toBeDefined();
    expect(started?.properties).toEqual({ source: 'plan_command' });

    const submitted = analytics.captures.find((c) => c.event === 'plan_review_submitted');
    expect(submitted).toBeDefined();
    expect(submitted?.properties?.['status']).toBe(deps.submission.status);
    expect(submitted?.properties?.['threads_count']).toBe(deps.submission.threads.length);
    expect(typeof submitted?.properties?.['duration_ms']).toBe('number');
  });

  it('closes the server when opening the browser fails', () => {
    const { context, analytics } = createStubContext({ openUrl: () => Promise.reject(new Error('open failed')) });
    const deps = createAnnotationDependencies();

    expect(runAnnotation(context, annotationArgs.build(), deps)).rejects.toThrow('open failed');
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
    expect(analytics.captures.some((c) => c.event === 'plan_review_submitted')).toBe(false);
  });

  it('maps the port-0 Bun bind failure to an annotation environment error', async () => {
    const { context } = createStubContext();
    const deps = createAnnotationDependencies();
    const cause = Object.assign(new Error('Failed to start server. Is port 0 in use?'), { code: 'EADDRINUSE' });
    deps.startReviewServer = () => {
      throw cause;
    };

    const caught = await runAnnotation(context, annotationArgs.build(), deps).then(
      () => null,
      (e: unknown) => e,
    );

    expect(caught).toBeInstanceOf(AnnotationEnvironmentError);
    expect((caught as AnnotationEnvironmentError).cause).toBe(cause);
    expect((caught as AnnotationEnvironmentError).message).toContain('network sandbox');
    expect(deps.closeCount).toBe(0);
  });

  it('keeps explicit-port EADDRINUSE failures as regular runtime failures', () => {
    const { context } = createStubContext();
    const deps = createAnnotationDependencies();
    const cause = Object.assign(new Error('Failed to start server. Is port 3456 in use?'), { code: 'EADDRINUSE' });
    deps.startReviewServer = () => {
      throw cause;
    };

    expect(runAnnotation(context, annotationArgs.build({ port: 3456 }), deps)).rejects.toBe(cause);
    expect(deps.closeCount).toBe(0);
  });

  it('keeps CONTEXTBRIDGE_PORT EADDRINUSE failures as regular runtime failures', () => {
    const { context } = createStubContext({ env: environment.build({ CONTEXTBRIDGE_PORT: 3456 }) });
    const deps = createAnnotationDependencies();
    const cause = Object.assign(new Error('Failed to start server. Is port 3456 in use?'), { code: 'EADDRINUSE' });
    deps.startReviewServer = () => {
      throw cause;
    };

    expect(runAnnotation(context, annotationArgs.build(), deps)).rejects.toBe(cause);
    expect(deps.closeCount).toBe(0);
  });

  it('closes the server and rejects when SIGINT is received', async () => {
    const { context, analytics } = createStubContext();
    const result = createDeferred<AnnotationSubmission>();
    const deps = createAnnotationDependencies({ result: result.promise });

    const reviewPromise = runAnnotation(context, annotationArgs.build(), deps);
    await deps.sigintHandlerRegistered;
    deps.triggerSigint();

    expect(reviewPromise).rejects.toThrow('annotation interrupted by SIGINT');
    expect(deps.closeCount).toBe(1);
    expect(deps.sigintHandlerRemoved).toBe(true);
    expect(analytics.captures.some((c) => c.event === 'plan_review_submitted')).toBe(false);
  });

  it('places sourcePath in payload.metadata.sourcePath when provided', () => {
    const { context } = createStubContext();
    const deps = createAnnotationDependencies();
    expect(
      runAnnotation(
        context,
        { content: '# doc', contentKind: 'document', entrypoint: 'open_command', sourcePath: '/abs/doc.md' },
        deps,
      ),
    ).resolves.toEqual(deps.submission);
    expect(deps.payloads[0]?.metadata?.sourcePath).toBe('/abs/doc.md');
  });

  it('omits sourcePath from payload.metadata when not provided', () => {
    const { context } = createStubContext();
    const deps = createAnnotationDependencies();
    expect(
      runAnnotation(context, { content: '# doc', contentKind: 'document', entrypoint: 'open_command' }, deps),
    ).resolves.toEqual(deps.submission);
    expect(deps.payloads[0]?.metadata?.sourcePath).toBeUndefined();
  });
});
