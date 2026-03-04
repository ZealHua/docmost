import { Card, Stack, Text, Group, Badge, Timeline, Box, Paper, Grid, Progress, Alert } from '@mantine/core';
import { IconClock, IconCoins, IconAlertCircle, IconSearch, IconWorld, IconAnalyze, IconSitemap } from '@tabler/icons-react';

interface ResearchPlanCardProps {
  plan: {
    id: string;
    title: string;
    description: string;
    steps: Array<{
      id: string;
      type: 'search' | 'crawl' | 'analyze' | 'synthesize';
      title: string;
      description: string;
      query?: string;
      urls?: string[];
      dependencies?: string[];
      estimatedDuration: string;
      required: boolean;
    }>;
    estimatedSources: number;
    estimatedTime: string;
    estimatedCost: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
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

const riskColors = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
};

export function ResearchPlanCard({ plan }: ResearchPlanCardProps) {
  const StepIcon = stepIcons[plan.steps[0]?.type] || IconSearch;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <StepIcon size={24} />
            <Text size="xl" fw={600}>
              {plan.title}
            </Text>
          </Group>
          <Badge color={riskColors[plan.riskLevel]} variant="light">
            {plan.riskLevel} risk
          </Badge>
        </Group>

        <Text size="sm" c="dimmed">
          {plan.description}
        </Text>

        <Paper p="md" withBorder>
          <Grid>
            <Grid.Col span={4}>
              <Stack gap={4} align="center">
                <IconClock size={20} color="#868e96" />
                <Text size="xs" c="dimmed">
                  Est. Time
                </Text>
                <Text size="sm" fw={500}>
                  {plan.estimatedTime}
                </Text>
              </Stack>
            </Grid.Col>
            <Grid.Col span={4}>
              <Stack gap={4} align="center">
                <IconSearch size={20} color="#868e96" />
                <Text size="xs" c="dimmed">
                  Sources
                </Text>
                <Text size="sm" fw={500}>
                  {plan.estimatedSources}
                </Text>
              </Stack>
            </Grid.Col>
            <Grid.Col span={4}>
              <Stack gap={4} align="center">
                <IconCoins size={20} color="#868e96" />
                <Text size="xs" c="dimmed">
                  Est. Cost
                </Text>
                <Text size="sm" fw={500}>
                  ${plan.estimatedCost.toFixed(2)}
                </Text>
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>

        <Box>
          <Text size="sm" fw={500} mb="xs">
            Research Steps:
          </Text>
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {plan.steps.map((step, index) => {
              const Icon = stepIcons[step.type];
              return (
                <Timeline.Item
                  key={step.id}
                  bullet={<Icon size={14} />}
                  color={stepColors[step.type]}
                >
                  <Stack gap={2}>
                    <Text size="sm" fw={500}>
                      {step.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {step.description}
                    </Text>
                    <Group gap="xs" mt={4}>
                      <Badge size="xs" variant="light">
                        {step.type}
                      </Badge>
                      <Badge size="xs" variant="light">
                        {step.estimatedDuration}
                      </Badge>
                      {step.required && (
                        <Badge size="xs" color="red" variant="light">
                          Required
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </Box>

        {plan.riskLevel === 'high' && (
          <Alert icon={<IconAlertCircle size={16} />} title="High Risk Research" color="red">
            This research plan involves multiple complex steps and may take longer than expected.
            Consider breaking it down into smaller research tasks.
          </Alert>
        )}

        <Box>
          <Text size="xs" c="dimmed" mb="xs">
            ⚠️ This research will consume your workspace quota:
          </Text>
          <Progress value={75} size="sm" />
        </Box>

      </Stack>
    </Card>
  );
}
