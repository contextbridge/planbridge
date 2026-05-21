import { annotationThread } from '@contextbridge/shared/testFactories';
import { Factory } from 'fishery';
import type { ResolvedAnnotationThread } from './annotationTypes.ts';
import { isAnnotationCommentThread } from './annotationTypes.ts';

export const resolvedAnnotationThread = Factory.define<ResolvedAnnotationThread>(({ params }) => {
  const seed = annotationThread.build(params.id ? { id: params.id } : {});
  if (!isAnnotationCommentThread(seed)) {
    throw new Error('Expected annotation thread factory to build an annotation thread');
  }

  const primaryMessage = seed.messages[0];
  if (!primaryMessage) {
    throw new Error('Expected annotation thread factory to include a primary message');
  }

  return {
    id: seed.id,
    anchor: seed.subject.anchor,
    range: document.createRange(),
    target: null,
    unresolved: false,
    quote: seed.subject.anchor.quote.exact,
    comments: [{ kind: 'saved', threadId: seed.id, message: primaryMessage, isPrimary: true }],
  };
});

export const resolvedAnnotationDraftThread = Factory.define<ResolvedAnnotationThread>(({ params }) => {
  const seed = annotationThread.build(params.id ? { id: params.id } : {});
  if (!isAnnotationCommentThread(seed)) {
    throw new Error('Expected annotation thread factory to build an annotation thread');
  }

  return {
    id: seed.id,
    anchor: seed.subject.anchor,
    range: document.createRange(),
    target: null,
    unresolved: false,
    quote: seed.subject.anchor.quote.exact,
    comments: [
      {
        kind: 'draft',
        mode: 'new-thread',
        draft: { kind: 'new-thread', anchor: seed.subject.anchor, body: '' },
      },
    ],
  };
});
