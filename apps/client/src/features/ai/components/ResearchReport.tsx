import { Card, Stack, Text, Badge, Group, Anchor, Box } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResearchReportProps {
  content: string;
  sources: Array<{
    url: string;
    title: string;
    excerpt: string;
  }>;
  isStreaming: boolean;
}

export function ResearchReport({ content, sources, isStreaming }: ResearchReportProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="lg" fw={600}>
            Research Report
          </Text>
          <Badge color={isStreaming ? 'blue' : 'green'} variant="light">
            {isStreaming ? 'Synthesizing...' : 'Completed'}
          </Badge>
        </Group>

        <Box>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </Box>

        {sources.length > 0 ? (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Sources ({sources.length})
            </Text>
            <Stack gap="xs">
              {sources.map((source) => (
                <Anchor key={source.url} href={source.url} target="_blank" size="sm">
                  {source.title || source.url}
                </Anchor>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Card>
  );
}
