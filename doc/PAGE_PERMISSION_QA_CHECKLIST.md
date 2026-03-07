# Page Permission QA Checklist

## Preconditions
- Redis is running and reachable by the server.
- App is running (`pnpm run dev` or equivalent server/client dev commands).
- Two users are available:
  - User A: admin/writer
  - User B: limited user

## Test Data Setup
1. In the same space, create this tree:
   - Root
     - Child1
       - Child2
   - OpenBranch
2. Restrict `Root` so only User A can access it.
3. Keep `OpenBranch` unrestricted.

## 1) WebSocket Visibility + Cache Behavior
1. Open User A and User B in separate browsers.
2. As User A, perform tree events on restricted branch (rename/move under `Root`).
3. As User A, perform tree events on `OpenBranch`.

Expected:
- User B does **not** receive restricted-branch sidebar updates.
- User B does receive `OpenBranch` updates.
- No server errors during events.

## 2) `permission-info` Contract Validation
For each page type below, call `POST /pages/permission-info`:
- Unrestricted page
- Directly restricted page
- Child page with inherited restriction

Expected fields:
- `hasDirectRestriction`
- `hasInheritedRestriction`
- `inheritedFrom` (only when inherited restriction exists)
- `canAccess`
- `canEdit`

Expected behavior consistency:
- Response values match what UI allows (edit/share/comment controls).

## 3) Share + Public Tree Pruning
1. Create/inspect share for restricted and open pages.
2. For include-subpages shares, inspect returned tree.

Expected:
- Restricted root is blocked from public share access.
- Restricted descendants are pruned from public trees.
- Open descendants remain visible when allowed.

## 4) Export Filtering
1. Export restricted root with include-children as User A.
2. Export same as User B.
3. Export unrestricted content containing page mentions.

Expected:
- User A gets only allowed nodes.
- User B cannot export inaccessible root (forbidden/no pages result).
- Mention links in exported output only resolve for pages the exporting user can access.

## 5) Regression Sanity
Run focused validation:
- `pnpm --filter server test src/ws/ws.gateway.spec.ts src/core/notification/services/page.notification.spec.ts src/core/page/services/page.service.spec.ts src/integrations/export/export.service.spec.ts src/core/share/share.service.spec.ts`
- `pnpm --filter server build`
- `pnpm --filter client build`

Expected:
- All tests pass.
- Server/client builds pass.
- Only known non-blocking Vite chunk warnings may appear.

## Pass Criteria
- No unauthorized visibility in sidebar/share/export.
- `permission-info` response shape and semantics are complete.
- No runtime errors in server logs for tested flows.
