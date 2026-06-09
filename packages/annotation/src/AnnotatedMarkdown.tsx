import type { AnnotationTargetKind, Asset } from '@contextbridge/shared/annotationSchema';
import { cn } from '@contextbridge/ui/lib/utils';
import type { Element } from 'hast';
import { createElement } from 'react';
import type { ComponentPropsWithoutRef, ComponentType, JSX, Ref } from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { adapterForLang } from './element/ElementAdapter.ts';
import {
  ELEMENT_LANG_PROPERTY,
  ELEMENT_SOURCE_PROPERTY,
  rehypeElementSources,
} from './element/rehypeElementSources.ts';

export const annotatedMarkdownTestIds = {
  container: 'plan-review-markdown-plan',
};

export interface AnnotatedMarkdownProps {
  content: string;
  containerRef: Ref<HTMLDivElement>;
  onMouseUp?: () => void;
  assets?: Asset[];
}

export function AnnotatedMarkdown({ content, containerRef, onMouseUp, assets }: AnnotatedMarkdownProps) {
  const assetsByPath = new Map<string, Asset>();
  for (const asset of assets ?? []) {
    assetsByPath.set(asset.originalPath, asset);
  }

  const components = {
    ...markdownComponents,
    img: ({ src, alt, ...rest }: ComponentPropsWithoutRef<'img'>) => {
      const match = assetsByPath.get(src ?? '');
      return <img src={match ? `/assets/${match.id}` : src} alt={alt} {...rest} />;
    },
  };

  return (
    <div
      ref={containerRef}
      className="cb-plan-content min-h-[24rem] px-1 py-2 [&>*+*]:mt-4 [&>:is(h1,h2)]:mt-8 [&>:is(h3,h4,h5,h6)]:mt-6 [&>:first-child]:mt-0 [&>:is(h1,h2,h3,h4,h5,h6)+*]:mt-2 [&_hr]:border-border/80 [&_ol]:ml-5 [&_ol]:grid [&_ol]:gap-2 [&_ol]:list-decimal [&_:not(pre)>code]:whitespace-pre-wrap [&_ul]:ml-5 [&_ul]:grid [&_ul]:gap-2 [&_ul]:list-disc"
      data-testid={annotatedMarkdownTestIds.container}
      onMouseUp={onMouseUp}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // rehypeElementSources must run before rehypeHighlight so a claimed block keeps its raw
        // source instead of being tokenized into highlight spans.
        rehypePlugins={[rehypeElementSources, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface AnnotatableConfig {
  targetKey: string;
  targetKind: AnnotationTargetKind;
  className?: string;
}

const TARGET_STYLE =
  'cb-annotatable-target cursor-pointer transition-colors duration-150 data-[target-state=hovered]:bg-chart-3/15 data-[target-state=hovered]:text-foreground';

type AnnotatableProps<Tag extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<Tag> & ExtraProps;

function annotatable<Tag extends keyof JSX.IntrinsicElements>(
  tag: Tag,
  config: AnnotatableConfig,
): ComponentType<AnnotatableProps<Tag>> {
  const Component = ({ className, node, ...props }: AnnotatableProps<Tag>) => {
    const position = node?.position;
    return createElement(tag, {
      ...props,
      'data-target-key': config.targetKey,
      'data-target-kind': config.targetKind,
      'data-src-start-line': position?.start.line,
      'data-src-end-line': position?.end.line,
      className: cn(TARGET_STYLE, config.className, className),
    });
  };
  Component.displayName = `Annotatable(${tag})`;
  return Component;
}

const HEADING_BASE = 'leading-tight';

const AnnotatableTable = annotatable('table', {
  targetKey: 'table',
  targetKind: 'table',
  className: 'min-w-full border-collapse border border-border text-left text-sm',
});

const AnnotatableAnchor = annotatable('a', {
  targetKey: 'a',
  targetKind: 'inline',
  className: 'font-medium text-chart-3 underline decoration-chart-3/35 underline-offset-4',
});

const AnnotatablePre = annotatable('pre', {
  targetKey: 'code',
  targetKind: 'code-block',
  className:
    'overflow-x-auto rounded-md border border-border bg-neutral-900 px-4 py-3 text-sm leading-6 text-neutral-50',
});

const markdownComponents = {
  h1: annotatable('h1', {
    targetKey: 'h1',
    targetKind: 'block',
    className: `${HEADING_BASE} text-2xl font-semibold`,
  }),
  h2: annotatable('h2', {
    targetKey: 'h2',
    targetKind: 'block',
    className: `${HEADING_BASE} text-xl font-semibold`,
  }),
  h3: annotatable('h3', {
    targetKey: 'h3',
    targetKind: 'block',
    className: `${HEADING_BASE} text-lg font-semibold`,
  }),
  h4: annotatable('h4', {
    targetKey: 'h4',
    targetKind: 'block',
    className: `${HEADING_BASE} text-base font-semibold`,
  }),
  h5: annotatable('h5', {
    targetKey: 'h5',
    targetKind: 'block',
    className: `${HEADING_BASE} text-base font-semibold`,
  }),
  h6: annotatable('h6', {
    targetKey: 'h6',
    targetKind: 'block',
    className: `${HEADING_BASE} text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground`,
  }),
  p: annotatable('p', {
    targetKey: 'p',
    targetKind: 'block',
    className: 'text-base leading-7 text-foreground/95',
  }),
  li: annotatable('li', {
    targetKey: 'li',
    targetKind: 'list-item',
    className: 'ml-2 pl-2 text-base leading-7',
  }),
  blockquote: annotatable('blockquote', {
    targetKey: 'blockquote',
    targetKind: 'block',
    className: 'border-l-4 border-chart-3/60 bg-chart-3/10 px-5 py-3 text-foreground/85 italic',
  }),
  pre: ({ node, children, ...props }: AnnotatableProps<'pre'>) => {
    const fallback = (
      <AnnotatablePre node={node} {...props}>
        {children}
      </AnnotatablePre>
    );
    const block = elementBlockFromPre(node);
    const adapter = block ? adapterForLang(block.lang) : undefined;
    if (!block || !adapter) {
      return fallback;
    }
    const Block = adapter.Block;
    return (
      <Block
        source={block.source}
        contentType={adapter.contentType}
        startLine={node?.position?.start.line}
        endLine={node?.position?.end.line}
        fallback={fallback}
      />
    );
  },
  tr: annotatable('tr', {
    targetKey: 'tr',
    targetKind: 'table-row',
    className: 'border-b border-border/70 last:border-b-0',
  }),
  th: annotatable('th', {
    targetKey: 'th',
    targetKind: 'table-cell',
    className: 'bg-muted/60 px-4 py-3 font-semibold text-foreground',
  }),
  td: annotatable('td', {
    targetKey: 'td',
    targetKind: 'table-cell',
    className: 'px-4 py-3 align-top',
  }),
  strong: annotatable('strong', {
    targetKey: 'strong',
    targetKind: 'inline',
    className: 'font-semibold text-foreground',
  }),
  em: annotatable('em', {
    targetKey: 'em',
    targetKind: 'inline',
    className: 'italic text-foreground',
  }),
  table: (props: ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto">
      <AnnotatableTable {...props} />
    </div>
  ),
  a: ({ rel, target, ...rest }: ComponentPropsWithoutRef<'a'>) => (
    <AnnotatableAnchor {...rest} rel={rel ?? 'noreferrer'} target={target ?? '_blank'} />
  ),
};

// Reads the source + language an element adapter stashed on a fenced code block (see
// rehypeElementSources). Returns undefined for ordinary code blocks, which render normally.
function elementBlockFromPre(node: Element | undefined): { lang: string; source: string } | undefined {
  const code = node?.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
  const source = code?.properties[ELEMENT_SOURCE_PROPERTY];
  const lang = code?.properties[ELEMENT_LANG_PROPERTY];
  return typeof source === 'string' && typeof lang === 'string' ? { lang, source } : undefined;
}
