import { Factory } from 'fishery';
import type {
  AnnotationPayload,
  AnnotationSubmission,
  Asset,
  CommentAuthor,
  CommentMessage,
  CommentThread,
  ElementAnnotationAnchor,
  TextAnnotationAnchor,
} from './annotationSchema.ts';
import type { FrontendConfig } from './frontendConfigSchema.ts';
import { type Settings, resolveSettings } from './settingsSchema.ts';

export const LOCAL_AUTHOR = {
  id: 'local-user',
  kind: 'user' as const,
  displayName: 'You',
};

export const asset = Factory.define<Asset>(() => ({
  id: 'asset_01',
  originalPath: '/tmp/diagram.png',
  mimeType: 'image/png',
  dataBase64: 'iVBORw0KGgo=',
}));

export const reviewer = Factory.define<CommentAuthor>(() => ({
  id: 'reviewer',
  kind: 'user',
  displayName: 'Reviewer',
}));

export const commentMessage = Factory.define<CommentMessage>(() => ({
  id: 'msg_01',
  author: LOCAL_AUTHOR,
  body: 'Why the parser first? Walk me through the ordering.',
  createdAt: '2026-04-20T12:34:56.000Z',
}));

export const annotationAnchor = Factory.define<TextAnnotationAnchor>(() => ({
  kind: 'text',
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

export const elementAnnotationAnchor = Factory.define<ElementAnnotationAnchor>(() => ({
  kind: 'element',
  contentType: 'mermaid',
  blockTargetId: 'mermaid:5',
  sourceLines: { start: 5, end: 9 },
  element: {
    id: 'login',
    label: 'Login',
    descriptor: 'diagram node',
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

export const annotationPayload = Factory.define<AnnotationPayload>(() => ({
  content: '# plan',
  contentKind: 'plan',
  metadata: { entrypoint: 'plan_command' },
}));

export const settings = Factory.define<Settings>(() => resolveSettings());

export const frontendConfig = Factory.define<FrontendConfig>(() => ({
  distinctId: 'test-distinct-id',
  telemetryDisabled: false,
  settings: settings.build(),
}));
