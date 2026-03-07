import api from '@/lib/api-client';

export interface IAuditLog {
  id: string;
  workspaceId: string;
  actorType: string;
  actorId?: string | null;
  eventType: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, any> | null;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  createdAt: string;
}

export interface IAuditLogListResponse {
  items: IAuditLog[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
}

export interface IAuditLogFilter {
  eventType?: string;
  resourceType?: string;
  actorId?: string;
  actorType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface IRetentionSettings {
  auditLogsDays: number;
  trashDays: number;
}

export interface IAuditExportResult {
  blob: Blob;
  isTruncated: boolean;
  exportLimit: number;
}

export async function getAuditLogs(
  filters: IAuditLogFilter,
): Promise<IAuditLogListResponse> {
  const req = await api.post<IAuditLogListResponse>('/ee/audit-logs/list', filters);
  return req.data;
}

export async function getAuditRetention(): Promise<IRetentionSettings> {
  const req = await api.post<IRetentionSettings>('/ee/audit-logs/retention');
  return req.data;
}

export async function updateAuditRetention(
  data: IRetentionSettings,
): Promise<IRetentionSettings> {
  const req = await api.post<IRetentionSettings>(
    '/ee/audit-logs/retention/update',
    data,
  );
  return req.data;
}

export async function exportAuditLogsCsv(
  filters: IAuditLogFilter,
): Promise<IAuditExportResult> {
  const req = await api.post('/ee/audit-logs/export', filters, {
    responseType: 'blob',
  });

  const headers = req.headers ?? {};
  const isTruncated =
    String(headers['x-audit-export-truncated'] ?? '').toLowerCase() === 'true';
  const exportLimit = Number.parseInt(
    String(headers['x-audit-export-limit'] ?? ''),
    10,
  );

  return {
    blob: req.data as Blob,
    isTruncated,
    exportLimit: Number.isInteger(exportLimit) ? exportLimit : 0,
  };
}
