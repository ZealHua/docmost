import { Card, Stack, Text, Group, Progress, Badge, Grid, Box } from '@mantine/core';
import { IconDatabase, IconSearch, IconWorld, IconFileText } from '@tabler/icons-react';

interface QuotaStatusProps {
  limits: {
    researchRequests: number;
    webSearches: number;
    crawlUrls: number;
    llmTokens: number;
  };
  used: {
    researchRequests: number;
    webSearches: number;
    crawlUrls: number;
    llmTokens: number;
  };
  totalCost: number;
  isEnabled: boolean;
  className?: string;
}

export function QuotaStatus({ limits, used, totalCost, isEnabled, className }: QuotaStatusProps) {
  const getPercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getColor = (percentage: number) => {
    if (percentage < 50) return 'blue';
    if (percentage < 80) return 'yellow';
    return 'red';
  };

  const quotaItems = [
    {
      name: 'Research Requests',
      icon: IconDatabase,
      used: used.researchRequests,
      limit: limits.researchRequests,
    },
    {
      name: 'Web Searches',
      icon: IconSearch,
      used: used.webSearches,
      limit: limits.webSearches,
    },
    {
      name: 'Crawl URLs',
      icon: IconWorld,
      used: used.crawlUrls,
      limit: limits.crawlUrls,
    },
    {
      name: 'LLM Tokens',
      icon: IconFileText,
      used: used.llmTokens,
      limit: limits.llmTokens,
    },
  ];

  if (!isEnabled) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder className={className}>
        <Group justify="center">
          <Badge color="gray" size="lg">
            Quota Tracking Disabled
          </Badge>
        </Group>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder className={className}>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="lg" fw={600}>
            Monthly Quota Usage
          </Text>
          <Badge color={totalCost > 10 ? 'red' : 'green'} variant="light">
            ${totalCost.toFixed(2)} spent
          </Badge>
        </Group>

        <Grid>
          {quotaItems.map((item) => {
            const Icon = item.icon;
            const percentage = getPercentage(item.used, item.limit);
            const color = getColor(percentage);

            return (
              <Grid.Col key={item.name} span={6}>
                <Box>
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Icon size={16} />
                      <Text size="xs" c="dimmed">
                        {item.name}
                      </Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      {item.used} / {item.limit}
                    </Text>
                  </Group>
                  <Progress
                    value={percentage}
                    color={color}
                    size="sm"
                    radius="xl"
                  />
                </Box>
              </Grid.Col>
            );
          })}
        </Grid>

        <Box
          p="xs"
          style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            border: '1px solid #e9ecef',
          }}
        >
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Resets monthly
            </Text>
            <Text size="xs" c="dimmed">
              {Math.round(
                ((limits.researchRequests - used.researchRequests) /
                  limits.researchRequests) *
                  100
              )}% requests remaining
            </Text>
          </Group>
        </Box>
      </Stack>
    </Card>
  );
}
