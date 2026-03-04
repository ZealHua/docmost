import { Modal, Stack, Text, Button, Group, Box, Badge, Paper } from '@mantine/core';
import { useState } from 'react';

interface ClarificationModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (answer: string) => void;
  question?: {
    question: string;
    options?: string[];
    context: string;
  };
  round: number;
}

export function ClarificationModal({
  opened,
  onClose,
  onSubmit,
  question,
  round,
}: ClarificationModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');

  if (!question) return null;

  const handleSubmit = () => {
    const answer = selectedOption || customAnswer;
    if (answer.trim()) {
      onSubmit(answer);
      setSelectedOption(null);
      setCustomAnswer('');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Clarification Needed"
      size="lg"
      centered
    >
      <Stack p="md" gap="md">
        <Group justify="space-between">
          <Badge color="orange" variant="light">
            Round {round} of 3
          </Badge>
          <Badge color="blue" variant="light">
            Deep Research
          </Badge>
        </Group>

        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed" mb="xs">
            Context:
          </Text>
          <Text size="sm" style={{ fontStyle: 'italic' }}>
            {question.context}
          </Text>
        </Paper>

        <Box>
          <Text size="lg" fw={500} mb="md">
            {question.question}
          </Text>

          {question.options && question.options.length > 0 && (
            <Stack gap="xs" mb="md">
              {question.options.map((option) => (
                <Button
                  key={option}
                  variant={selectedOption === option ? 'filled' : 'outline'}
                  onClick={() => setSelectedOption(option)}
                  fullWidth
                  styles={(theme) => ({
                    root: {
                      justifyContent: 'flex-start',
                      height: 'auto',
                      padding: theme.spacing.sm,
                      whiteSpace: 'normal',
                      textAlign: 'left',
                    },
                  })}
                >
                  {option}
                </Button>
              ))}
            </Stack>
          )}

          <Text size="sm" c="dimmed" mb="xs">
            Or provide a custom answer:
          </Text>
          <textarea
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="Type your answer here..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              border: '1px solid #e9ecef',
              borderRadius: '4px',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: '14px',
            }}
          />
        </Box>

        <Group justify="space-between" mt="md">
          <Button variant="outline" onClick={onClose}>
            Cancel Research
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedOption && !customAnswer.trim()}
          >
            Submit Answer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
