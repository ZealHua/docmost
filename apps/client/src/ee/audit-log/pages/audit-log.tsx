import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { getAppName } from '@/lib/config';
import SettingsTitle from '@/components/settings/settings-title';
import {
  Button,
  Collapse,
  Code,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useExportAuditLogsMutation,
  useAuditLogsQuery,
  useAuditRetentionQuery,
  useUpdateAuditRetentionMutation,
} from '@/ee/audit-log/queries/audit-log-query';
import useUserRole from '@/hooks/use-user-role.tsx';
import Paginate from '@/components/common/paginate';
import { useTranslation } from 'react-i18next';

export default function AuditLogPage() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const [eventType, setEventType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [actorType, setActorType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const limit = 25;

  const resourceOptions = [
    { label: t('All resources'), value: '' },
    { label: 'Auth', value: 'auth' },
    { label: 'Workspace', value: 'workspace' },
    { label: 'Page', value: 'page' },
    { label: 'Comment', value: 'comment' },
    { label: 'Attachment', value: 'attachment' },
    { label: 'Group', value: 'group' },
    { label: 'Space', value: 'space' },
  ];

  useEffect(() => {
    setOffset(0);
  }, [eventType, resourceType, actorType, fromDate, toDate]);

  const { data: logsData, isLoading } = useAuditLogsQuery({
    eventType: eventType || undefined,
    resourceType: resourceType || undefined,
    actorType: actorType || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit,
    offset,
  });

  const { data: retention } = useAuditRetentionQuery();
  const updateRetentionMutation = useUpdateAuditRetentionMutation();
  const exportMutation = useExportAuditLogsMutation();
  const [auditLogsDays, setAuditLogsDays] = useState<number | ''>('');
  const [trashDays, setTrashDays] = useState<number | ''>('');

  const canSaveRetention = useMemo(() => {
    return (
      typeof auditLogsDays === 'number' &&
      typeof trashDays === 'number' &&
      auditLogsDays > 0 &&
      trashDays > 0
    );
  }, [auditLogsDays, trashDays]);

  const activeFilters = {
    eventType: eventType || undefined,
    resourceType: resourceType || undefined,
    actorType: actorType || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };

  const handleExport = async () => {
    const exportResult = await exportMutation.mutateAsync(activeFilters);
    const url = window.URL.createObjectURL(exportResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildExportFilename(activeFilters);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    if (exportResult.isTruncated) {
      notifications.show({
        message: t('Audit export was truncated to {{count}} rows', {
          count: exportResult.exportLimit,
        }),
        color: 'orange',
      });
      return;
    }

    notifications.show({
      message: t('Audit logs exported successfully'),
    });
  };

  const buildExportFilename = (filters: typeof activeFilters) => {
    const parts = ['audit-logs'];
    const today = new Date().toISOString().slice(0, 10);

    if (filters.eventType) {
      parts.push(sanitizeForFilename(filters.eventType));
    }

    if (filters.resourceType) {
      parts.push(sanitizeForFilename(filters.resourceType));
    }

    if (filters.actorType) {
      parts.push(sanitizeForFilename(filters.actorType));
    }

    if (filters.fromDate) {
      parts.push(`from-${sanitizeForFilename(filters.fromDate)}`);
    }

    if (filters.toDate) {
      parts.push(`to-${sanitizeForFilename(filters.toDate)}`);
    }

    parts.push(today);
    return `${parts.join('-')}.csv`;
  };

  const sanitizeForFilename = (value: string) => {
    return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 40);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>{t('Audit log')} - {getAppName()}</title>
      </Helmet>

      <SettingsTitle title={t('Audit log')} />

      <Stack gap="md" mb="lg">
        <Text size="sm" c="dimmed">
          {t('Review workspace activity and configure retention.')}
        </Text>

        <Text size="sm" c="dimmed">
          {t(
            'Exports are capped by workspace settings. If an export is truncated, refine filters or reduce date range.',
          )}
        </Text>

        <Group justify="flex-end">
          <Button loading={exportMutation.isPending} onClick={handleExport}>
            {t('Export CSV')}
          </Button>
        </Group>

        <Group align="flex-end">
          <TextInput
            label={t('Event type')}
            placeholder={t('e.g. page.deleted')}
            value={eventType}
            onChange={(event) => setEventType(event.currentTarget.value)}
            w={280}
          />
          <Select
            label={t('Resource')}
            value={resourceType}
            data={resourceOptions}
            onChange={(value) => setResourceType(value ?? '')}
            w={220}
          />
          <Select
            label={t('Actor type')}
            value={actorType}
            data={[
              { label: t('All actors'), value: '' },
              { label: t('User'), value: 'user' },
              { label: t('API'), value: 'api' },
              { label: t('System'), value: 'system' },
              { label: t('Anonymous'), value: 'anonymous' },
            ]}
            onChange={(value) => setActorType(value ?? '')}
            w={220}
          />
        </Group>

        <Group align="flex-end">
          <TextInput
            type="date"
            label={t('From date')}
            value={fromDate}
            onChange={(event) => setFromDate(event.currentTarget.value)}
            w={220}
          />
          <TextInput
            type="date"
            label={t('To date')}
            value={toDate}
            onChange={(event) => setToDate(event.currentTarget.value)}
            w={220}
          />
          <Button
            variant="default"
            onClick={() => {
              setEventType('');
              setResourceType('');
              setActorType('');
              setFromDate('');
              setToDate('');
              setOffset(0);
            }}
          >
            {t('Reset filters')}
          </Button>
        </Group>

        <Group align="flex-end">
          <NumberInput
            label={t('Audit log retention (days)')}
            min={1}
            max={3650}
            placeholder={String(retention?.auditLogsDays ?? 365)}
            value={auditLogsDays}
            onChange={(value) => setAuditLogsDays(Number(value) || '')}
            w={240}
          />
          <NumberInput
            label={t('Trash retention (days)')}
            min={1}
            max={3650}
            placeholder={String(retention?.trashDays ?? 30)}
            value={trashDays}
            onChange={(value) => setTrashDays(Number(value) || '')}
            w={240}
          />
          <Button
            loading={updateRetentionMutation.isPending}
            disabled={!canSaveRetention}
            onClick={() =>
              updateRetentionMutation.mutate({
                auditLogsDays: auditLogsDays as number,
                trashDays: trashDays as number,
              })
            }
          >
            {t('Save retention')}
          </Button>
        </Group>
      </Stack>

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Time')}</Table.Th>
            <Table.Th>{t('Event')}</Table.Th>
            <Table.Th>{t('Resource')}</Table.Th>
            <Table.Th>{t('Actor')}</Table.Th>
            <Table.Th>{t('Resource ID')}</Table.Th>
            <Table.Th>{t('Action')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && (
            <Table.Tr>
              <Table.Td colSpan={6}>{t('Loading audit logs...')}</Table.Td>
            </Table.Tr>
          )}

          {!isLoading && (logsData?.items?.length ?? 0) === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>{t('No audit logs found')}</Table.Td>
            </Table.Tr>
          )}

          {logsData?.items?.map((item) => {
            const isExpanded = expandedLogId === item.id;

            return (
              <>
                <Table.Tr key={item.id}>
                  <Table.Td>{new Date(item.createdAt).toLocaleString()}</Table.Td>
                  <Table.Td>{item.eventType}</Table.Td>
                  <Table.Td>{item.resourceType}</Table.Td>
                  <Table.Td>{item.actorType}</Table.Td>
                  <Table.Td>{item.resourceId ?? '-'}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() =>
                        setExpandedLogId((curr) =>
                          curr === item.id ? null : item.id,
                        )
                      }
                    >
                      {isExpanded ? t('Hide details') : t('Show details')}
                    </Button>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr key={`${item.id}-details`}>
                  <Table.Td colSpan={6}>
                    <Collapse in={isExpanded}>
                      <Stack gap="xs">
                        <Text fw={500}>{t('Metadata')}</Text>
                        <Code block>
                          {JSON.stringify(item.metadata ?? {}, null, 2)}
                        </Code>

                        <Text fw={500}>{t('Before')}</Text>
                        <Code block>{JSON.stringify(item.before ?? {}, null, 2)}</Code>

                        <Text fw={500}>{t('After')}</Text>
                        <Code block>{JSON.stringify(item.after ?? {}, null, 2)}</Code>
                      </Stack>
                    </Collapse>
                  </Table.Td>
                </Table.Tr>
              </>
            );
          })}
        </Table.Tbody>
      </Table>

      <Paginate
        hasPrevPage={Boolean(logsData?.meta?.hasPrevPage)}
        hasNextPage={Boolean(logsData?.meta?.hasNextPage)}
        onPrev={() => setOffset((curr) => Math.max(curr - limit, 0))}
        onNext={() => setOffset((curr) => curr + limit)}
      />
    </>
  );
}
