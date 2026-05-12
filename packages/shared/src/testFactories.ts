import { Factory } from 'fishery';
import type {
  AnnotationSubmission,
  CommentAuthor,
  CommentMessage,
  CommentThread,
  StoredAnnotationAnchor,
} from './annotationSchema.ts';
import type { UpdateOutcome } from './updateOutcomeSchema.ts';

export const LOCAL_AUTHOR = {
  id: 'local-user',
  kind: 'human' as const,
  displayName: 'You',
};

export const reviewer = Factory.define<CommentAuthor>(() => ({
  id: 'reviewer',
  kind: 'human',
  displayName: 'Reviewer',
}));

export const commentMessage = Factory.define<CommentMessage>(() => ({
  id: 'msg_01',
  author: LOCAL_AUTHOR,
  body: 'Why the parser first? Walk me through the ordering.',
  createdAt: '2026-04-20T12:34:56.000Z',
}));

export const annotationAnchor = Factory.define<StoredAnnotationAnchor>(() => ({
  createdFrom: 'drag',
  sourceLines: { start: 3, end: 3 },
  quote: {
    exact: 'Start by refactoring the parser',
    prefix: 'first step: ',
    suffix: ' before touching the API',
  },
  position: { start: 12, end: 43 },
  endpoints: {
    start: { targetId: 'li:0:3f9a0c11', offset: 12 },
    end: { targetId: 'li:0:3f9a0c11', offset: 43 },
  },
  target: {
    id: 'li:0:3f9a0c11',
    kind: 'list-item',
    label: 'List item: "Start by refactoring the parser"',
  },
  snapshot: {
    targetText: 'Start by refactoring the parser before touching the API',
  },
}));

export const annotationThread = Factory.define<CommentThread>(() => {
  const messages: CommentThread['messages'] = [commentMessage.build()];
  return {
    id: 'thr_ann_01',
    subject: { kind: 'annotation', anchor: annotationAnchor.build() },
    messages,
  };
});

export const globalThread = Factory.define<CommentThread>(() => {
  const messages: CommentThread['messages'] = [
    commentMessage.build({ id: 'msg_global_01', body: 'Spell out rollback, owners, and success criteria.' }),
  ];
  return {
    id: 'thr_global_01',
    subject: { kind: 'global' },
    messages,
  };
});

export const annotationSubmission = Factory.define<AnnotationSubmission>(() => ({
  status: 'changes_requested',
  threads: [globalThread.build(), annotationThread.build()],
}));

export const updateOutcome = Factory.define<UpdateOutcome>(() => ({
  status: 'success',
}));
