import type {
  CommentMessage,
  CommentThread,
  CommentThreadSubject,
  PlanReviewSubmission,
  SourceLineRange,
} from '@contextbridge/shared/planReviewSchema';
import { instantFromString } from '@contextbridge/shared/time';
import Handlebars from 'handlebars';
import type { Blockquote, Root } from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import annotationSectionSource from './templates/annotationSection.hbs' with { type: 'text' };
import approvedSource from './templates/approved.hbs' with { type: 'text' };
import changesRequestedSource from './templates/changesRequested.hbs' with { type: 'text' };
import generalFeedbackSectionSource from './templates/generalFeedbackSection.hbs' with { type: 'text' };

type AnnotationSubject = Extract<CommentThreadSubject, { kind: 'annotation' }>;

const approvedTemplate = Handlebars.compile(approvedSource, { noEscape: true });
const changesRequestedTemplate = Handlebars.compile(changesRequestedSource, { noEscape: true });
const generalFeedbackSectionTemplate = Handlebars.compile(generalFeedbackSectionSource, { noEscape: true });
const annotationSectionTemplate = Handlebars.compile(annotationSectionSource, { noEscape: true });

export function formatAsMarkdown(submission: PlanReviewSubmission, planContent: string): string {
  if (submission.status === 'approved') {
    return approvedTemplate({});
  }

  const planLines = planContent.split('\n');
  const sections: string[] = [];
  const globalThreads = submission.threads.filter((thread) => thread.subject.kind === 'global');
  const annotationThreads = submission.threads.filter(
    (thread): thread is CommentThread & { subject: AnnotationSubject } => thread.subject.kind === 'annotation',
  );

  if (globalThreads.length > 0) {
    sections.push(generalFeedbackSectionTemplate({ threads: renderThreadsAsBlockquotes(globalThreads) }));
  }

  for (const thread of annotationThreads) {
    const { sourceLines, quote } = thread.subject.anchor;
    sections.push(
      annotationSectionTemplate({
        range: formatLineRange(sourceLines),
        sourceSlice: sliceSource(planLines, sourceLines),
        highlighted: formatHighlighted(quote.exact),
        thread: renderThreadsAsBlockquotes([thread]),
      }),
    );
  }

  const body = sections.map((section) => section.trimEnd()).join('\n\n');
  return `${changesRequestedTemplate({ body }).trimEnd()}\n`;
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

function sliceSource(planLines: string[], { start, end }: SourceLineRange): string {
  // Source lines are 1-indexed; array indices are 0-indexed.
  return planLines.slice(start - 1, end).join('\n');
}

function formatHighlighted(exact: string): string | undefined {
  // Multi-line selections are already fully captured by the line-granular source slice,
  // and inline-code delimiters don't cross newlines — skip the call-out in that case.
  if (exact.includes('\n')) return undefined;
  return toMarkdown({ type: 'inlineCode', value: exact }).trimEnd();
}
