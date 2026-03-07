# Page Permission Flow

This document describes the complete page-level permission system flow in Docmost, including the permission model, validation mechanisms, integration points, and implementation details.

## Overview

The page permission system provides granular access control at the page level, allowing workspace members to restrict access to individual pages and control who can view or edit them. The system supports hierarchical inheritance where child pages inherit restrictions from their ancestors.

## Permission Model

### Data Structure

**page_access** table:
- Stores restriction state for individual pages
- Tracks workspace and space context
- Maintains creator and timestamp information

**page_permissions** table:
- Maps users/groups to restricted pages
- Defines access roles (reader/writer)
- Records who granted the permission and when

### Permission Roles

- **reader**: View-only access to the page and its descendants
- **writer**: Full edit access including the ability to manage page access permissions

### Inheritance Mechanism

- Child pages automatically inherit restrictions from parent pages
- Users must have permission on **all** restricted ancestors in the path to access a page
- Restrictions cascade down the page hierarchy
- Inheritance is calculated dynamically at query time using recursive CTEs

## Permission Validation Flow

### 1. Read Permission Validation

```
┌─────────────────────────────────────────────┐
│ validateCanView(page, user)                 │
└─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Check space membership│
        │ (space-level check)   │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Query page restriction│
        │ - Direct restrictions?│
        │ - Inherited restrictions?│
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ For each restricted  │
        │ ancestor:            │
        │ Check user permission│
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ All ancestors have   │
        │ permission? → ACCESS │
        │ Any ancestor missing  │
        │ permission? → DENY   │
        └───────────────────────┘
```

### 2. Edit Permission Validation

```
┌─────────────────────────────────────────────┐
│ validateCanEdit(page, user)                 │
└─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Execute read validation│
        │ (same as above)       │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Find nearest restricted│
        │ ancestor               │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Check user role on    │
        │ that ancestor:        │
        │                       │
        │ writer → EDIT ACCESS  │
        │ reader → READ ONLY    │
        │ unrestricted → SPACE  │
        │ permissions           │
        └───────────────────────┘
```

## Core Service Flow

### PageAccessService

The `PageAccessService` provides centralized permission validation:

```typescript
async validateCanView(page: Page, user: User): Promise<void>
  → Check space membership via SpaceAbility
  → Check page-level access via PagePermissionRepo.canUserAccessPage()
  → Throw ForbiddenException if no access

async validateCanEdit(page: Page, user: User): Promise<{hasRestriction: boolean}>
  → Check space membership
  → Check page-level edit permission
  → Return restriction status

async validateCanViewWithPermissions(page: Page, user: User): 
  Promise<{canEdit: boolean; hasRestriction: boolean}>
  → Combined view + edit check in single query
  → Return effective permissions
```

### PagePermissionRepo

The repository handles complex permission queries using recursive CTEs:

```typescript
async canUserEditPage(userId: string, pageId: string): 
  Promise<{hasAnyRestriction: boolean; canAccess: boolean; canEdit: boolean}>
  → Recursive CTE to build ancestor chain
  → Check permissions on all restricted ancestors
  → Return combined access status in single query

async filterAccessiblePageIds(opts: {pageIds: string[], userId: string}): 
  Promise<string[]>
  → Batch filter multiple page IDs
  → Return only accessible page IDs

async getUserIdsWithPageAccess(pageId: string, candidateUserIds: string[]): 
  Promise<string[]>
  → Filter users who can access a specific page
  → Used for notification recipient filtering
```

## UI Flow

### Restricting a Page

```
User clicks "Restrict access"
        │
        ▼
Frontend: POST /pages/restrict {pageId}
        │
        ▼
Backend: PageAccessService.validateCanEdit()
        │
        ▼
Backend: PageService.restrictPage()
        │
        ├→ Create page_access record
        ├→ Cache invalidation
        └→ WebSocket notification
        │
        ▼
Frontend: Update UI
        │
        ├→ Show lock icon on page
        ├→ Update tree view
        └→ Refresh permission status
```

### Adding User Permissions

```
Admin selects user/group
        │
        ▼
Selects permission level (reader/writer)
        │
        ▼
Frontend: POST /pages/add-permission {
  pageId, role, userIds[], groupIds[]
}
        │
        ▼
Backend: Permission validation
        │
        ▼
Backend: PageService.addPagePermission()
        │
        ├→ Create page_permissions records
        ├→ Queue notification job
        └→ WebSocket notification
        │
        ▼
Notification service processes:
        │
        ├→ Send email to user
        └→ Create in-app notification
        │
        ▼
WebSocket: notifyPermissionGranted()
        │
        ▼
Frontend: User sees page appear in tree
```

## Integration Points

### 1. Comment System

```typescript
// Only users with edit permission can comment
const canComment: boolean = page?.permissions?.canEdit ?? false;

// Notification filtering
const usersWithAccess = await pagePermissionRepo.getUserIdsWithPageAccess(
  pageId, 
  candidateUserIds
);
```

### 2. Attachment Operations

```typescript
// Upload requires edit permission
await pageAccessService.validateCanEdit(page, user);

// Read requires view permission
await pageAccessService.validateCanView(page, user);
```

### 3. Search Results

```typescript
// Filter search results by page access
const accessibleIds = await pagePermissionRepo.filterAccessiblePageIds({
  pageIds: searchResultIds,
  userId,
  spaceId
});

results = results.filter(r => accessibleIds.includes(r.id));
```

### 4. Export Functionality

```typescript
// Pre-export validation
await pageAccessService.validateCanView(page, user);

// Filter accessible pages maintaining tree integrity
const filteredPages = await filterPagesForExport(
  allPages, 
  rootPageId, 
  userId, 
  spaceId
);

// Filter inaccessible target pages in mentions
const accessibleMentionIds = await pagePermissionRepo.filterAccessiblePageIds({
  pageIds: mentionPageIds,
  userId
});
```

### 5. Public Sharing

```typescript
// Restricted pages cannot be publicly shared
const isRestricted = await pagePermissionRepo.hasRestrictedAncestor(pageId);
if (isRestricted) {
  throw new BadRequestException('Cannot share a restricted page');
}

// Use optimized subtree query for shared pages
const pageTree = await pageRepo.getPageAndDescendantsExcludingRestricted(
  share.pageId,
  { includeContent: false }
);
```

## WebSocket Event Flow

### Permission Change Notification

```
Permission change occurs
        │
        ▼
WsService.invalidateSpaceRestrictionCache(spaceId)
        │
        ├→ Clear Redis cache entry
        └→ Update memory cache
        │
        ▼
WsGateway.notifyPagePermissionChanged(spaceId, pageId)
        │
        ├→ Emit 'refetchRootTreeNodeEvent' to space
        └→ Emit 'invalidate' event for specific page
        │
        ▼
For users WITH new access:
        │
        ▼
WsTreeService.notifyPermissionGranted(page, userIds)
        │
        ▼
Frontend receives 'addTreeNode' event
        │
        ▼
Page appears in tree view
        │
        ▼
For users WITHOUT access:
        │
        ▼
WsTreeService.notifyPageRestricted(page, excludeUserId)
        │
        ▼
Frontend receives 'deleteTreeNode' event
        │
        ▼
Page disappears from tree view
```

### Tree Event Filtering

```typescript
// Only broadcast tree events to authorized users
await wsService.broadcastToAuthorizedUsers(
  senderSocket,
  room,
  pageId,
  eventData
);

// Check space has restrictions first
const hasRestrictions = await spaceHasRestrictions(spaceId);
if (!hasRestrictions) {
  // Broadcast to all - no filtering needed
  broadcastToRoom(room, data);
  return;
}

// Filter by page-level access
const authorizedUsers = await pagePermissionRepo.getUserIdsWithPageAccess(
  pageId,
  candidateUserIds
);
```

## Caching Strategy

### Cache Tiers

1. **Space Restriction Cache** (Redis)
   - Key: `ws:space-restrictions:{spaceId}`
   - TTL: 30 seconds
   - Stores: Whether space has any restricted pages

2. **User Page Access Cache** (Memory)
   - Key: `{userId}:{pageId}`
   - TTL: 30 seconds
   - Stores: User's access status for specific page

3. **Restricted Ancestor Cache** (Memory)
   - Key: `page:{pageId}`
   - TTL: 30 seconds
   - Stores: Whether page has restricted ancestors

### Cache Invalidation

```typescript
// On permission changes
invalidateSpaceRestrictionCache(spaceId);

// On page creation/deletion/move
invalidatePageRestrictionCache(pageId);

// On space membership changes
invalidateSpaceRestrictionCache(spaceId);
```

## Performance Optimizations

### Query Optimization

1. **Recursive CTE for Ancestor Chains**
   ```sql
   WITH RECURSIVE ancestors AS (
     SELECT id, parent_page_id, 0 as depth
     FROM pages WHERE id = {pageId}
     UNION ALL
     SELECT p.id, p.parent_page_id, a.depth + 1
     FROM pages p JOIN ancestors a ON a.parent_page_id = p.id
   )
   ```

2. **Batch Permission Checking**
   ```typescript
   // Single query for multiple pages
   const accessibleIds = await filterAccessiblePageIds({
     pageIds: [id1, id2, id3, ...],
     userId
   });
   ```

3. **Space-Level Fast Path**
   ```typescript
   // Skip filtering if space has no restrictions
   const hasRestrictions = await hasRestrictedPagesInSpace(spaceId);
   if (!hasRestrictions) {
     return pageIds; // No filtering needed
   }
   ```

### Optimized Subtree Queries

```typescript
// Stops traversal at restricted nodes
async getPageAndDescendantsExcludingRestricted(
  parentPageId: string,
  opts: { includeContent: boolean }
) {
  // Uses recursive CTE with isRestricted flag
  // Only recurses into children of non-restricted pages
  // Filters out restricted pages from result
}
```

## Error Handling

### Frontend Error Handling

```typescript
// Optimistic updates with rollback
const addPermission = async () => {
  // Update UI optimistically
  setPendingPermissions([...permissions, newPermission]);
  
  try {
    await api.post('/pages/add-permission', data);
  } catch (error) {
    // Rollback on failure
    setPendingPermissions(permissions);
    showNotification(error.message, 'error');
  }
};

// Network retry mechanism
const fetchWithRetry = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
};
```

### Backend Error Handling

```typescript
// Unified permission errors
async validateCanView(page: Page, user: User): Promise<void> {
  const ability = await this.spaceAbility.createForUser(user, page.spaceId);
  if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
    throw new ForbiddenException();
  }

  const canAccess = await this.pagePermissionRepo.canUserAccessPage(
    user.id, page.id
  );
  
  if (!canAccess) {
    this.logger.warn(`User ${user.id} denied access to page: ${page.id}`);
    throw new ForbiddenException();
  }
}

// Transaction rollback on permission changes
await executeTx(this.db, async (trx) => {
  await pagePermissionRepo.deletePageAccess(pageId, trx);
  await pagePermissionRepo.insertPagePermissions(permissions, trx);
});
```

## Security Considerations

### 1. Permission Elevation Prevention

```typescript
// Users cannot modify their own permissions
if (memberId === currentUser?.id) {
  return (
    <Text size="sm" c="dimmed">
      {t(roleLabel)}
    </Text>
  );
}

// Only space admins can grant admin-level permissions
if (role === 'admin' && !isSpaceAdmin) {
  throw new ForbiddenException();
}
```

### 2. Data Isolation

```typescript
// Workspace-level isolation
const ability = await this.spaceAbility.createForUser(user, page.spaceId);
if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
  throw new ForbiddenException();
}

// Space-level isolation in queries
.query.where('spaceId', '=', spaceId)

// Cascade delete on page deletion
onDelete('cascade')
```

### 3. Audit Logging

```typescript
// Log permission changes
this.logger.info(`Page permission changed`, {
  pageId,
  userId: actor.id,
  action: 'grant',
  targetUserId: userId,
  role,
});

// Log access denials
this.logger.warn(`Access denied`, {
  userId: user.id,
  pageId,
  reason: 'missing_permission',
});
```

## Testing Coverage

### Unit Tests

```typescript
// PagePermissionRepo query tests
describe('PagePermissionRepo', () => {
  it('should check user edit permission correctly', async () => {
    const result = await repo.canUserEditPage(userId, pageId);
    expect(result.hasAnyRestriction).toBe(true);
    expect(result.canEdit).toBe(true);
  });

  it('should filter accessible page IDs', async () => {
    const accessible = await repo.filterAccessiblePageIds({
      pageIds: [id1, id2, id3],
      userId
    });
    expect(accessible).toEqual([id1, id3]);
  });
});
```

### Integration Tests

```typescript
// End-to-end permission flow
describe('Page Permission Flow', () => {
  it('should complete full permission grant cycle', async () => {
    // 1. Restrict page
    await restrictPage(pageId);
    
    // 2. Grant user access
    await addPermission({ pageId, userId, role: 'writer' });
    
    // 3. Verify user can access
    const canAccess = await canUserAccessPage(userId, pageId);
    expect(canAccess).toBe(true);
    
    // 4. Verify notification sent
    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'permission_granted' })
    );
  });

  it('should handle inheritance correctly', async () => {
    // Create page hierarchy: A -> B -> C
    // Restrict A, grant user access to A
    // User should automatically access B and C
    
    const restrictedA = await restrictPage(pageA);
    await addPermission({ pageId: pageA, userId, role: 'reader' });
    
    const canAccessB = await canUserAccessPage(userId, pageB);
    const canAccessC = await canUserAccessPage(userId, pageC);
    
    expect(canAccessB).toBe(true);
    expect(canAccessC).toBe(true);
  });
});
```

### Performance Tests

```typescript
// Cache effectiveness
describe('Permission Caching', () => {
  it('should use cache for repeated requests', async () => {
    const start = Date.now();
    
    // First request - cache miss
    await canUserAccessPage(userId, pageId);
    const firstCall = Date.now() - start;
    
    // Second request - cache hit
    await canUserAccessPage(userId, pageId);
    const secondCall = Date.now() - start - firstCall;
    
    expect(secondCall).toBeLessThan(firstCall * 0.1); // Should be much faster
  });

  it('should invalidate cache on permission changes', async () => {
    // Populate cache
    await canUserAccessPage(userId, pageId);
    
    // Change permissions
    await addPermission({ pageId, userId, role: 'writer' });
    
    // Should not use stale cache
    const result = await canUserAccessPage(userId, pageId);
    expect(result.canEdit).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues

1. **User cannot access restricted page**
   - Verify user has permission on all restricted ancestors
   - Check cache invalidation
   - Verify space membership

2. **Tree not updating after permission change**
   - Check WebSocket connection
   - Verify event broadcasting
   - Check cache invalidation

3. **Search results not filtered**
   - Verify `filterAccessiblePageIds` is called
   - Check search query integration
   - Verify permission query logic

### Debug Tools

```typescript
// Enable debug logging
process.env.DEBUG = 'page-permission:*';

// Check cache state
const cacheKey = `ws:space-restrictions:${spaceId}`;
const cached = await cacheManager.get(cacheKey);

// Trace permission check
this.logger.debug('Permission check', {
  userId,
  pageId,
  result: { hasRestriction, canAccess, canEdit }
});
```

## References

- **QA Checklist**: `doc/PAGE_PERMISSION_QA_CHECKLIST.md`
- **API Endpoints**: See `page.controller.ts` for all permission-related endpoints
- **Database Schema**: See migration `20260306T120000-page-permissions.ts`
- **Frontend Components**: See `apps/client/src/ee/page-permission/`
- **WebSocket Events**: See `ws.service.ts` and `ws-tree.service.ts`