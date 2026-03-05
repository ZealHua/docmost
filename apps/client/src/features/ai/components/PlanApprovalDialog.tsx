import { Modal, Stack, Group, Button, Alert, TextInput, Textarea, Paper, Text, Divider } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { ResearchPlanCard } from './ResearchPlanCard';
import { IconCheck, IconX } from '@tabler/icons-react';
import { ResearchPlan } from '../state/deep-research.machine';

interface PlanApprovalDialogProps {
  opened: boolean;
  onClose: () => void;
  plan?: ResearchPlan;
  onApprove: (plan: ResearchPlan) => void;
  onReject: () => void;
}

export function PlanApprovalDialog({
  opened,
  onClose,
  plan,
  onApprove,
  onReject,
}: PlanApprovalDialogProps) {
  const [editablePlan, setEditablePlan] = useState<ResearchPlan | undefined>(plan);

  useEffect(() => {
    setEditablePlan(plan);
  }, [plan]);

  const hasChanges = useMemo(() => {
    if (!plan || !editablePlan) {
      return false;
    }
    return JSON.stringify(plan) !== JSON.stringify(editablePlan);
  }, [editablePlan, plan]);

  const handleApprove = () => {
    if (!editablePlan) {
      return;
    }
    onApprove(editablePlan);
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  if (!plan || !editablePlan) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Research Plan Approval"
      size="xl"
      centered
      styles={{
        body: {
          maxHeight: '80vh',
          overflowY: 'auto',
        },
      }}
    >
      <Stack gap="md">
        <Alert title="Review Required" color="blue">
          The AI has generated a research plan. Review and optionally edit before continuing.
        </Alert>

        <Stack gap="sm">
          <TextInput
            label="Plan title"
            value={editablePlan.title}
            onChange={(event) => {
              const title = event.currentTarget.value;
              setEditablePlan((prev) => (prev ? { ...prev, title } : prev));
            }}
          />
          <Textarea
            label="Plan description"
            autosize
            minRows={2}
            value={editablePlan.description}
            onChange={(event) => {
              const description = event.currentTarget.value;
              setEditablePlan((prev) => (prev ? { ...prev, description } : prev));
            }}
          />
        </Stack>

        <Divider label="Steps" labelPosition="left" />

        <Stack gap="sm">
          {editablePlan.steps.map((step, index) => (
            <Paper key={step.id} withBorder p="sm" radius="md">
              <Stack gap="xs">
                <Text size="sm" fw={600}>Step {index + 1}</Text>
                <TextInput
                  label="Step title"
                  value={step.title}
                  onChange={(event) => {
                    const title = event.currentTarget.value;
                    setEditablePlan((prev) => {
                      if (!prev) {
                        return prev;
                      }
                      const steps = prev.steps.map((currentStep) =>
                        currentStep.id === step.id ? { ...currentStep, title } : currentStep,
                      );
                      return { ...prev, steps };
                    });
                  }}
                />
                <Textarea
                  label="Step description"
                  autosize
                  minRows={2}
                  value={step.description}
                  onChange={(event) => {
                    const description = event.currentTarget.value;
                    setEditablePlan((prev) => {
                      if (!prev) {
                        return prev;
                      }
                      const steps = prev.steps.map((currentStep) =>
                        currentStep.id === step.id ? { ...currentStep, description } : currentStep,
                      );
                      return { ...prev, steps };
                    });
                  }}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>

        {hasChanges && (
          <Alert color="yellow" title="Edited plan">
            Your edits will be used for execution and stored in approval audit.
          </Alert>
        )}

        <ResearchPlanCard plan={editablePlan} />

        <Group justify="space-between" mt="md">
          <Button
            variant="outline"
            leftSection={<IconX size={16} />}
            onClick={handleReject}
          >
            Cancel Research
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={handleApprove}
          >
            Approve & Continue
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
