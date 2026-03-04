import { Modal, Stack, Group, Button, Alert } from '@mantine/core';
import { ResearchPlanCard } from './ResearchPlanCard';
import { IconCheck, IconX } from '@tabler/icons-react';

interface PlanApprovalDialogProps {
  opened: boolean;
  onClose: () => void;
  plan: any;
  onApprove: () => void;
  onReject: () => void;
}

export function PlanApprovalDialog({
  opened,
  onClose,
  plan,
  onApprove,
  onReject,
}: PlanApprovalDialogProps) {
  const handleApprove = () => {
    onApprove();
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  if (!plan) return null;

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
          The AI has generated a research plan. Please review and confirm to continue.
        </Alert>

        <ResearchPlanCard plan={plan} />

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
