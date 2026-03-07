# Audit Logs Operations

This document summarizes runtime controls and export behavior for enterprise audit logs.

## Environment Configuration

- `AUDIT_LOG_EXPORT_MAX_ROWS` (default: `5000`)
  - Controls max rows returned by `POST /api/ee/audit-logs/export`.
  - If omitted or invalid, server falls back to `5000`.

Example in `.env`:

```dotenv
AUDIT_LOG_EXPORT_MAX_ROWS=5000
```

## Export Behavior

- Endpoint: `POST /api/ee/audit-logs/export`
- Response: `text/csv; charset=utf-8`
- CSV includes UTF-8 BOM for Excel compatibility.
- Export is filtered by the same filter payload used by `POST /api/ee/audit-logs/list`.

## Truncation Signaling

When results exceed `AUDIT_LOG_EXPORT_MAX_ROWS`, server truncates output and signals it in two ways:

1. CSV note row at the top of the file.
2. Response headers:
   - `X-Audit-Export-Truncated: true|false`
   - `X-Audit-Export-Limit: <maxRows>`

Frontend uses these headers to show a warning toast when export is truncated.

## Retention

- Retention settings are workspace-scoped (audit log retention days + trash retention days).
- Cleanup job removes audit rows older than configured retention per workspace.
