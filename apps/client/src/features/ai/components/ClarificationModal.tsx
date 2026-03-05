import { Modal, Stack, Text, Button, Group, Box, Badge, Paper, Textarea } from '@mantine/core';
import { useState } from 'react';
import styles from './ClarificationModal.module.css';

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

  const oneShotText = round > 0
    ? 'Final clarification before research continues.'
    : 'One clarification before research continues.';

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
          <Badge variant="light" className={styles.headerBadge}>
            One-shot clarification
          </Badge>
          <Badge className={styles.headerBadge} variant="light">
            Deep Research
          </Badge>
        </Group>

        <Text className={styles.helperText}>{oneShotText}</Text>

        <Paper p="md" withBorder className={styles.contextCard}>
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
                  className={styles.optionButton}
                  data-selected={selectedOption === option ? 'true' : 'false'}
                >
                  {option}
                </Button>
              ))}
            </Stack>
          )}

          <Text size="sm" c="dimmed" mb="xs">
            Or provide a custom answer:
          </Text>
          <Textarea
            className={styles.customInput}
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="Type your answer here..."
            minRows={4}
            autosize
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
