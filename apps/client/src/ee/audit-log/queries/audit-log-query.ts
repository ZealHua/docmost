import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  exportAuditLogsCsv,
  getAuditLogs,
  IAuditExportResult,
  getAuditRetention,
  IAuditLogFilter,
  IRetentionSettings,
  updateAuditRetention,
} from '@/ee/audit-log/services/audit-log-service';
import { notifications } from '@mantine/notifications';

export function useAuditLogsQuery(filters: IAuditLogFilter) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters),
  });
}

export function useAuditRetentionQuery() {
  return useQuery({
    queryKey: ['audit-log-retention'],
    queryFn: () => getAuditRetention(),
  });
}

export function useUpdateAuditRetentionMutation() {
  const queryClient = useQueryClient();

  return useMutation<IRetentionSettings, Error, IRetentionSettings>({
    mutationFn: (data) => updateAuditRetention(data),
    onSuccess: () => {
      notifications.show({ message: 'Retention settings updated' });
      queryClient.invalidateQueries({ queryKey: ['audit-log-retention'] });
    },
    onError: (error) => {
      const errorMessage = error['response']?.data?.message;
      notifications.show({ message: errorMessage, color: 'red' });
    },
  });
}

export function useExportAuditLogsMutation() {
  return useMutation<IAuditExportResult, Error, IAuditLogFilter>({
    mutationFn: (filters) => exportAuditLogsCsv(filters),
    onError: (error) => {
      const errorMessage = error['response']?.data?.message;
      notifications.show({
        message: errorMessage || 'Failed to export audit logs',
        color: 'red',
      });
    },
  });
}
