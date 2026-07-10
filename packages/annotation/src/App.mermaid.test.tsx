import '@contextbridge/ui/styles.css';
import type { AnnotationSubmission, ElementAnnotationAnchor } from '@contextbridge/shared/annotationSchema';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent as browserUserEvent } from 'vitest/browser';
import { annotatedMarkdownTestIds } from './AnnotatedMarkdown.tsx';
import { annotationDraftCommentComposerTestIds } from './AnnotationDraftCommentComposer.tsx';
import { annotationThreadCardTestIds } from './AnnotationThreadCard.tsx';
import { appTestIds } from './App.tsx';
import { commentsSidebarTestIds } from './CommentsSidebar.tsx';
import { elementBlockAttrs } from './element/elementBlock.ts';
import { mermaidAttrs } from './element/mermaid/MermaidBlock.tsx';
import { annotateAndSubmit, drag, renderApp, saveAnnotation } from './testHelpers/index.tsx';

// End-to-end through the real `mermaid` dependency: a plan with a fenced mermaid block flows through
// AnnotatedMarkdown → MermaidBlock (renders the SVG and tags its nodes/edges)
// → useElementTargets → the mermaid adapter's buildAnchor → the submitted payload. Rendering with
// the actual library — not a hand-built SVG — is the point: a mermaid upgrade that changes the
// rendered structure the adapter keys off (node element ids, edge-label markup) breaks these tests.
describe('App — Mermaid diagram annotation', () => {
  afterEach(() => {
    cleanup();
  });

  it('reports a node annotation to the agent as a "diagram node"', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    const node = await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Login"]`);
    const submission = await annotateAndSubmit({
      user,
      submitAnnotation,
      target: node,
      body: 'Should the login form support SSO?',
    });

    expect(submission).toMatchObject({
      status: 'changes_requested',
      threads: [
        {
          subject: { kind: 'annotation' },
          messages: [{ body: 'Should the login form support SSO?' }],
        },
      ],
    });
    expect(expectElementAnchor(submission)).toMatchObject({
      contentType: 'mermaid',
      blockTargetId: `mermaid:${MERMAID_PLAN.fence.start}`,
      sourceLines: MERMAID_PLAN.fence,
      element: { id: 'Login', label: 'Login form', descriptor: 'diagram node' },
    });
  });

  it('reports a labeled-edge annotation as a "diagram edge"', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    const edge = await waitForDiagramElement(`[${mermaidAttrs.edgeId}][${mermaidAttrs.label}="valid"]`);
    const submission = await annotateAndSubmit({
      user,
      submitAnnotation,
      target: edge,
      body: 'Where does a valid token go next?',
    });

    const anchor = expectElementAnchor(submission);
    expect(anchor).toMatchObject({
      contentType: 'mermaid',
      element: { label: 'valid', descriptor: 'diagram edge' },
    });
    // The edge id is mermaid's own opaque identifier; assert it was captured, not its exact value.
    expect(anchor.element.id).toBeTruthy();
  });

  it('reports a click on empty diagram space as the whole "diagram"', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    const block = await waitForDiagramElement(`[${elementBlockAttrs.blockId}]`);
    const submission = await annotateAndSubmit({
      user,
      submitAnnotation,
      target: block,
      body: 'Add a logout path to this flow.',
    });

    const anchor = expectElementAnchor(submission);
    expect(anchor).toMatchObject({
      contentType: 'mermaid',
      element: { label: 'diagram', descriptor: 'diagram' },
    });
    expect(anchor.element.id).toBeUndefined();
  });

  it('anchors each comment to its own diagram when the plan has several', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: MULTI_DIAGRAM_PLAN.content },
    });

    // Two diagrams are only distinguishable to the agent by source span, so comment on both and
    // confirm each anchor carries the line range of the diagram it was placed on.
    await saveAnnotation({
      user,
      target: await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Login"]`),
      body: 'Login-diagram comment',
    });
    const submission = await annotateAndSubmit({
      user,
      submitAnnotation,
      target: await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Logout"]`),
      body: 'Logout-diagram comment',
    });

    const anchors = elementAnchorsByBody(submission);
    expect(anchors['Login-diagram comment']).toMatchObject({
      blockTargetId: `mermaid:${MULTI_DIAGRAM_PLAN.loginFence.start}`,
      sourceLines: MULTI_DIAGRAM_PLAN.loginFence,
      element: { id: 'Login', descriptor: 'diagram node' },
    });
    expect(anchors['Logout-diagram comment']).toMatchObject({
      blockTargetId: `mermaid:${MULTI_DIAGRAM_PLAN.logoutFence.start}`,
      sourceLines: MULTI_DIAGRAM_PLAN.logoutFence,
      element: { id: 'Logout', descriptor: 'diagram node' },
    });
  });

  it('replaces an empty diagram draft when clicking a different element', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    // Open an empty draft on one node, then comment on a different one without typing first. The
    // empty draft is replaced (no discard prompt), so the submitted thread anchors to the second
    // node — matching the text-selection path.
    fireEvent.click(await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Login"]`));
    await screen.findByTestId(annotationDraftCommentComposerTestIds.container);

    const submission = await annotateAndSubmit({
      user,
      submitAnnotation,
      target: await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Dashboard"]`),
      body: 'Comment on the dashboard node',
    });

    expect(submission?.threads).toHaveLength(1);
    expect(expectElementAnchor(submission).element).toMatchObject({ id: 'Dashboard', descriptor: 'diagram node' });
  });

  it('keeps an annotated node styled as annotated while hovered, but still previews un-annotated nodes', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    // Anchor the assertion below: an un-annotated node swaps to the preview fill on hover, proving
    // hover styling is live. Without this, the annotated check could pass simply because hover
    // never fired.
    const unannotatedNode = await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Dashboard"]`);
    const unannotated = await fillAroundHover(unannotatedNode);
    expect(unannotated.hovered).not.toBe(unannotated.resting);

    // A committed annotation's fill must survive hover (the `:not(.cb-mermaid-annotated)` guard in
    // mermaidAdapter.css); otherwise the dark label sits on the dark hover fill until the cursor
    // leaves. Mirrors how text hover never clobbers a saved highlight.
    const annotatedNode = await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Login"]`);
    await saveAnnotation({ user, target: annotatedNode, body: 'Support SSO?' });
    const annotated = await fillAroundHover(annotatedNode);
    expect(annotated.hovered).toBe(annotated.resting);
  });

  it('orders the sidebar by document position when a diagram comment precedes a text comment', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    // Comment on the prose below the diagram, then on a node in the diagram above it. The sidebar
    // must list the diagram comment first — it comes first in the document.
    const paragraph = await screen.findByText('Annotate a node or edge above.');
    drag({ target: paragraph.firstChild as Text, from: 0, to: 'Annotate'.length });
    await user.type(
      await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea),
      'Text comment below the diagram',
    );
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));
    await waitFor(() => {
      expect(screen.queryByTestId(annotationDraftCommentComposerTestIds.container)).not.toBeInTheDocument();
    });

    await saveAnnotation({
      user,
      target: await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Login"]`),
      body: 'Diagram comment above the text',
    });

    expect(getCommentCardBodies()).toEqual(['Diagram comment above the text', 'Text comment below the diagram']);
  });

  it('prompts to discard a dirty diagram draft when clicking a different element', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: MERMAID_PLAN.content } });

    // A draft with typed-but-unsaved text must not be silently dropped on the next click.
    fireEvent.click(await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Login"]`));
    await user.type(await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea), 'Unsaved note');

    fireEvent.click(await waitForDiagramElement(`[${mermaidAttrs.nodeId}="Dashboard"]`));

    expect(await screen.findByTestId(appTestIds.discardDraftDialog)).toBeInTheDocument();
  });
});

// Plan fixtures pair the markdown with the 1-indexed source line span of each ```mermaid fence (the
// span the mermaid block stamps onto its anchors). Hardcoded rather than derived so the expected
// anchor lines are obvious; keep them in sync with the content if you edit it.
const MERMAID_PLAN = {
  content: [
    '# Auth flow',
    '',
    'The login sequence the middleware enforces:',
    '',
    '```mermaid', // line 5
    'flowchart TD',
    '  Login[Login form] --> Verify{Verify token}',
    '  Verify -->|valid| Dashboard[Dashboard]',
    '  Verify -->|invalid| Login',
    '```', // line 10
    '',
    'Annotate a node or edge above.',
  ].join('\n'),
  fence: { start: 5, end: 10 },
};

const MULTI_DIAGRAM_PLAN = {
  content: [
    '# Auth flows',
    '',
    'Login sequence:',
    '',
    '```mermaid', // line 5
    'flowchart TD',
    '  Login[Login form] --> Dashboard[Dashboard]',
    '```', // line 8
    '',
    'Logout sequence:',
    '',
    '```mermaid', // line 12
    'flowchart TD',
    '  Logout[Logout button] --> Goodbye[Goodbye]',
    '```', // line 15
  ].join('\n'),
  loginFence: { start: 5, end: 8 },
  logoutFence: { start: 12, end: 15 },
};

// Hover `node` and report the fill of its shape child (`g.… > rect|polygon|…`, where the marker and
// hover rules paint) before and after — the comparison that tells stable annotation styling from a
// hover preview that swaps the fill.
async function fillAroundHover(node: Element): Promise<{ resting: string; hovered: string }> {
  const shape = node.querySelector<SVGGraphicsElement>('rect, circle, ellipse, polygon, path');
  if (!shape) {
    throw new Error('Diagram node has no shape element to style.');
  }
  const resting = getComputedStyle(shape).fill;
  await browserUserEvent.hover(node);
  return { resting, hovered: getComputedStyle(shape).fill };
}

/** Saved comment bodies in sidebar render order. */
function getCommentCardBodies(): string[] {
  const cardTestIdPrefix = annotationThreadCardTestIds.card('');
  const commentTestIdPrefix = annotationThreadCardTestIds.comment('');
  const cards = screen
    .getByTestId(commentsSidebarTestIds.threadList)
    .querySelectorAll<HTMLElement>(`[data-testid^="${cardTestIdPrefix}"]`);
  return Array.from(cards).map(
    (card) => card.querySelector(`[data-testid^="${commentTestIdPrefix}"]`)?.textContent ?? '',
  );
}

async function waitForDiagramElement(selector: string): Promise<Element> {
  return await waitFor(
    () => {
      const element = screen.getByTestId(annotatedMarkdownTestIds.container).querySelector(selector);
      if (!element) {
        throw new Error(`Diagram element not rendered yet: ${selector}`);
      }
      return element;
    },
    { timeout: 5000 },
  );
}

function expectElementAnchor(submission: AnnotationSubmission | undefined): ElementAnnotationAnchor {
  const subject = submission?.threads[0]?.subject;
  const anchor = subject?.kind === 'annotation' ? subject.anchor : null;
  if (anchor?.kind !== 'element') {
    throw new Error(`Expected an element anchor, got ${anchor?.kind ?? 'none'}`);
  }
  return anchor;
}

function elementAnchorsByBody(submission: AnnotationSubmission | undefined): Record<string, ElementAnnotationAnchor> {
  const byBody: Record<string, ElementAnnotationAnchor> = {};
  for (const thread of submission?.threads ?? []) {
    const { subject } = thread;
    const body = thread.messages[0]?.body;
    if (subject.kind === 'annotation' && subject.anchor.kind === 'element' && body) {
      byBody[body] = subject.anchor;
    }
  }
  return byBody;
}
