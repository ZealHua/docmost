import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Popover, Text, Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import { RagSource } from '../types/ai-chat.types';
import { buildPageUrl } from '@/features/page/page.utils';
import cardStyles from './AiMessageCard.module.css';

interface AiCitationRendererProps {
  content: string;
  sources: RagSource[];
}

/**
 * Renders AI-generated markdown with inline citation popovers.
 *
 * The LLM is prompted to cite sources using [^n] notation.
 * This component:
 *   1. Pre-processes [^n] → <cite data-ref="n">n</cite>
 *   2. rehype-raw allows <cite> through the pipeline
 *   3. rehype-sanitize strips all other HTML (XSS prevention)
 *   4. The custom 'cite' component renders as a Mantine Popover
 */

// Extend the default sanitize schema to allow only <cite data-ref>
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'cite'],
  attributes: {
    ...defaultSchema.attributes,
    cite: ['dataRef'],
  },
};

const preprocessCitations = (text: string): string =>
  text.replace(/\[\^(\d+)\]/g, '<cite data-ref="$1">$1</cite>');

export function AiCitationRenderer({ content, sources }: AiCitationRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema], // must come AFTER rehype-raw
      ]}
      components={{
        // @ts-ignore — 'cite' is a valid HTML element, typings are incomplete
        cite: ({ node, children }) => {
          const ref = Number(node?.properties?.dataRef);
          const source = sources[ref - 1];

          if (!source) {
            return <span className={cardStyles.citationBadge}>{ref}</span>;
          }

          return (
            <Popover withArrow width={280} position="top" shadow="md">
              <Popover.Target>
                <span className={cardStyles.citationBadge}>
                  {ref}
                </span>
              </Popover.Target>
              <Popover.Dropdown>
                <Text fw={600} size="sm" mb={4}>
                  {source.title}
                </Text>
                {source.excerpt && (
                  <Text c="dimmed" size="xs" mb={8} lineClamp={3}>
                    {source.excerpt}
                  </Text>
                )}
                <Anchor
                  component={Link}
                  to={buildPageUrl(source.spaceSlug, source.slugId, source.title)}
                  size="xs"
                >
                  Open page →
                </Anchor>
              </Popover.Dropdown>
            </Popover>
          );
        },
      }}
    >
      {preprocessCitations(content)}
    </ReactMarkdown>
  );
}
