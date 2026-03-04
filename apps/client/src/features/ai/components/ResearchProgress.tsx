import { Card, Stack, Text, Timeline, Group, Badge, Progress, Box, Accordion, Alert } from '@mantine/core';
import { IconClock, IconSearch, IconWorld, IconAnalyze, IconSitemap, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface ResearchProgressProps {
  stepProgress: Record<string, {
    status: 'idle' | 'running' | 'completed' | 'failed';
    progress: number;
    error?: string;
  }>;
  steps: Array<{
    id: string;
    type: 'search' | 'crawl' | 'analyze' | 'synthesize';
    title: string;
    description: string;
    estimatedDuration: string;
  }>;
  sources: Array<{
    url: string;
    title: string;
    excerpt: string;
  }>;
  collectedContent: string;
}

const stepIcons = {
  search: IconSearch,
  crawl: IconWorld,
  analyze: IconAnalyze,
  synthesize: IconSitemap,
};

const stepColors = {
  search: 'blue',
  crawl: 'green',
  analyze: 'orange',
  synthesize: 'purple',
};

const statusColors = {
  idle: 'gray',
  running: 'blue',
  completed: 'green',
  failed: 'red',
};

const statusIcons = {
  idle: IconClock,
  running: IconClock,
  completed: IconCheck,
  failed: IconX,
};

export function ResearchProgress({ stepProgress, steps, sources, collectedContent }: ResearchProgressProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Find the first step that's not completed
    const firstIncomplete = steps.findIndex((step) => stepProgress[step.id]?.status !== 'completed');
    setActiveStep(firstIncomplete === -1 ? steps.length : firstIncomplete);
  }, [stepProgress, steps]);

  const getStepStatus = (stepId: string) => {
    return stepProgress[stepId]?.status || 'idle';
  };

  const getStepProgress = (stepId: string) => {
    return stepProgress[stepId]?.progress || 0;
  };

  const allStepsCompleted = steps.every((step) => getStepStatus(step.id) === 'completed');
  const hasFailedSteps = steps.some((step) => getStepStatus(step.id) === 'failed');

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="lg">
        <Group justify="space-between">
          <Text size="xl" fw={600}>
            Research Progress
          </Text>
          {allStepsCompleted && (
            <Badge color="green" size="lg">
              Completed
            </Badge>
          )}
          {hasFailedSteps && (
            <Badge color="red" size="lg">
              Errors
            </Badge>
          )}
          {!allStepsCompleted && !hasFailedSteps && (
            <Badge color="blue" size="lg" variant="light">
              In Progress
            </Badge>
          )}
        </Group>

        <Timeline active={activeStep} bulletSize={28} lineWidth={2}>
          {steps.map((step) => {
            const Icon = stepIcons[step.type];
            const StatusIcon = statusIcons[getStepStatus(step.id)];
            const status = getStepStatus(step.id);
            const progress = getStepProgress(step.id);

            return (
              <Timeline.Item
                key={step.id}
                bullet={<Icon size={14} />}
                color={stepColors[step.type]}
                title={
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {step.title}
                    </Text>
                    <Group gap="xs">
                      <StatusIcon size={14} color={statusColors[status]} />
                      <Badge
                        size="xs"
                        color={statusColors[status]}
                        variant="light"
                      >
                        {status}
                      </Badge>
                    </Group>
                  </Group>
                }
              >
                <Stack gap="xs">
                  <Text size="xs" c="dimmed">
                    {step.description}
                  </Text>
                  <Group gap="xs">
                    <Badge size="xs" variant="light">
                      {step.type}
                    </Badge>
                    <Badge size="xs" variant="light">
                      {step.estimatedDuration}
                    </Badge>
                  </Group>
                  {status === 'running' && progress > 0 && (
                    <Progress value={progress} size="sm" radius="xl" />
                  )}
                  {status === 'failed' && stepProgress[step.id]?.error && (
                    <Alert icon={<IconAlertCircle size={14} />} color="red">
                      {stepProgress[step.id]?.error}
                    </Alert>
                  )}
                </Stack>
              </Timeline.Item>
            );
          })}
        </Timeline>

        {sources.length > 0 && (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Sources Found ({sources.length})
            </Text>
            <Accordion variant="contained">
              {sources.slice(0, 5).map((source, index) => (
                <Accordion.Item key={source.url} value={source.url}>
                  <Accordion.Control>
                    <Group justify="space-between">
                      <Text size="xs" truncate>
                        {source.title || `Source ${index + 1}`}
                      </Text>
                      <Badge size="xs" color="blue" variant="light">
                        {source.url.split('/')[2]}
                      </Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Text size="xs" c="dimmed">
                      {source.excerpt}
                    </Text>
                    <Text
                      size="xs"
                      c="blue"
                      component="a"
                      href={source.url}
                      target="_blank"
                      mt="xs"
                    >
                      View Source →
                    </Text>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
              {sources.length > 5 && (
                <Box p="xs">
                  <Text size="xs" c="dimmed" ta="center">
                    + {sources.length - 5} more sources
                  </Text>
                </Box>
              )}
            </Accordion>
          </Box>
        )}

        {collectedContent && (
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Research Report (Streaming)
            </Text>
            <Box
              p="md"
              style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #e9ecef',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {collectedContent}
              </Text>
              {!allStepsCompleted && (
                <Text size="xs" c="blue" mt="xs">
                  ▼ Streaming...
                </Text>
              )}
            </Box>
          </Box>
        )}

        {!allStepsCompleted && !hasFailedSteps && (
          <Box
            p="xs"
            style={{
              backgroundColor: '#e7f5ff',
              borderRadius: '4px',
              border: '1px solid #d0ebff',
            }}
          >
            <Text size="xs" c="blue" ta="center">
              Research in progress... This may take 1-3 minutes depending on the complexity.
            </Text>
          </Box>
        )}
      </Stack>
    </Card>
  );
}
