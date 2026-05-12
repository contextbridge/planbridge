import type {
  AnnotationSubmission,
  CommentMessage,
  CommentThread,
  CommentThreadSubject,
  SourceLineRange,
} from '@contextbridge/shared/annotationSchema';
import { instantFromString } from '@contextbridge/shared/time';
import type { Blockquote, Root } from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { AnnotationTemplates } from './templates.ts';

type AnnotationSubject = Extract<CommentThreadSubject, { kind: 'annotation' }>;

export function formatAgentResponse(
  templates: AnnotationTemplates,
  submission: AnnotationSubmission,
  content: string,
  opts: { sourcePath?: string } = {},
): string {
  if (submission.status === 'approved') {
    return templates.approved({ source: opts.sourcePath });
  }

  const contentLines = content.split('\n');
  const sections: string[] = [];
  const globalThreads = submission.threads.filter((thread) => thread.subject.kind === 'global');
  const annotationThreads = submission.threads.filter(
    (thread): thread is CommentThread & { subject: AnnotationSubject } => thread.subject.kind === 'annotation',
  );

  if (globalThreads.length > 0) {
    sections.push(templates.generalFeedbackSection({ comments: renderThreadsAsBlockquotes(globalThreads) }));
  }

  for (const thread of annotationThreads) {
    const { sourceLines, quote } = thread.subject.anchor;
    sections.push(
      templates.annotationSection({
        range: formatLineRange(sourceLines),
        sourceSlice: sliceSource(contentLines, sourceLines),
        highlighted: formatHighlighted(quote.exact),
        comments: renderThreadsAsBlockquotes([thread]),
      }),
    );
  }

  const body = sections.map((section) => section.trimEnd()).join('\n\n');
  return `${templates.changesRequested({ body, source: opts.sourcePath }).trimEnd()}\n`;
}

function renderThreadsAsBlockquotes(threads: CommentThread[]): string {
  const blockquotes: Blockquote[] = threads.flatMap((thread) => sortMessages(thread.messages).map(messageToBlockquote));

  const root: Root = { type: 'root', children: blockquotes };
  return toMarkdown(root).trimEnd();
}

function messageToBlockquote(message: CommentMessage): Blockquote {
  const body = message.body.replaceAll('\r\n', '\n');
  const timestamp = instantFromString(message.createdAt).toString({ smallestUnit: 'second' });
  const attribution = `— ${message.author.kind}, ${timestamp}`;

  return {
    type: 'blockquote',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value: `${body}\n${attribution}` }],
      },
    ],
  };
}

function sortMessages(messages: CommentMessage[]): CommentMessage[] {
  return [...messages].sort((left, right) => compareInstants(left.createdAt, right.createdAt));
}

function compareInstants(left: string, right: string): number {
  const leftInstant = instantFromString(left).epochNanoseconds;
  const rightInstant = instantFromString(right).epochNanoseconds;

  if (leftInstant < rightInstant) {
    return -1;
  }

  if (leftInstant > rightInstant) {
    return 1;
  }

  return 0;
}

function formatLineRange({ start, end }: SourceLineRange): string {
  return start === end ? `line ${start}` : `lines ${start}–${end}`;
}

function sliceSource(contentLines: string[], { start, end }: SourceLineRange): string {
  // Source lines are 1-indexed; array indices are 0-indexed.
  return contentLines.slice(start - 1, end).join('\n');
}

function formatHighlighted(exact: string): string | undefined {
  // Multi-line selections are already fully captured by the line-granular source slice,
  // and inline-code delimiters don't cross newlines — skip the call-out in that case.
  if (exact.includes('\n')) return undefined;
  return toMarkdown({ type: 'inlineCode', value: exact }).trimEnd();
}
