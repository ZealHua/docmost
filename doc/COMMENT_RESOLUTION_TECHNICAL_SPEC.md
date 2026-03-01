# Comment Resolution Technical Specification

## Overview

This document describes the technical implementation of the comment resolution feature in Docmost, which allows users to resolve and re-open comments. The feature is available in Cloud and Enterprise editions and is gated by license checks on both frontend and backend.

## Architecture

The comment resolution system follows a client-server architecture with optimistic UI updates, real-time synchronization via WebSocket, and permission-based access control.

```
┌─────────────────┐         API Call         ┌─────────────────┐
│   Frontend      │ ──────────────────────►  │   Backend       │
│  (React/TSX)    │                          │  (NestJS)       │
└─────────────────┘                          └─────────────────┘
        │                                            │
        │ 1. Optimistic Update                       │
        │ 2. Editor State Update                     │
        │ 3. WebSocket Emit                          │
        │                                            │
        ▼                                            ▼
┌─────────────────┐                    ┌─────────────────────┐
│  React Query    │                    │   PostgreSQL DB      │
│     Cache       │                    │   (Kysely)           │
└─────────────────┘                    └─────────────────────┘
        │                                            │
        │ 4. Real Data Update                        │ 5. DB Update
        │ 6. UI Re-render                            │    (resolvedAt,
        │                                            │     resolvedById)
        ▼                                            ▼
┌─────────────────┐
│   Mantine UI    │
│  (Open/Resolved │
│      Tabs)      │
└─────────────────┘
```

## Data Model

### Comment Entity

Location: `apps/server/src/database/types/db.d.ts`

```typescript
export interface Comment {
  id: string;
  content: Json | null;
  createdAt: Timestamp;
  creatorId: string | null;
  deletedAt: Timestamp | null;
  editedAt: Timestamp | null;
  pageId: string;
  parentCommentId: string | null;
  resolvedAt: Timestamp | null;        // Key field for resolution state
  resolvedById: string | null;         // User who resolved the comment
  spaceId: string;
  updatedAt: Timestamp;
  workspaceId: string;
  creator: User;
  resolvedBy: User;                     // Populated via Kysely relation
}
```

**Resolution State Logic:**
- `resolvedAt !== null` → Comment is resolved
- `resolvedAt === null` → Comment is open
- `resolvedById` tracks which user resolved the comment

## Frontend Implementation

### 1. License Check

Location: `apps/client/src/hooks/use-is-cloud-ee.tsx`

```typescript
export const useIsCloudEE = () => {
  const { hasLicenseKey } = useLicense();
  return isCloud() || !!hasLicenseKey;
};
```

The feature is only available when:
- Running in Cloud mode (`CONFIG.CLOUD = true`), OR
- Workspace has a valid license key

### 2. Main Component

Location: `apps/client/src/features/comment/components/comment-list-with-tabs.tsx`

**Tab Separation Logic (Lines 54-74):**

```typescript
const { activeComments, resolvedComments } = useMemo(() => {
  if (!comments?.items) {
    return { activeComments: [], resolvedComments: [] };
  }

  const parentComments = comments.items.filter(
    (comment: IComment) => comment.parentCommentId === null,
  );

  const active = parentComments.filter(
    (comment: IComment) => !comment.resolvedAt,
  );
  const resolved = parentComments.filter(
    (comment: IComment) => comment.resolvedAt,
  );

  return { activeComments: active, resolvedComments: resolved };
}, [comments]);
```

**Key Points:**
- Only parent comments are displayed in tabs (`parentCommentId === null`)
- Replies are nested under their parent comments
- Filtering based on `resolvedAt` field determines Open/Resolved categorization

### 3. Resolve Mutation

Location: `apps/client/src/ee/comment/queries/comment-query.ts`

```typescript
export function useResolveCommentMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const emit = useQueryEmit();

  return useMutation({
    mutationFn: (data: IResolveComment) => resolveComment(data),

    // Optimistic Update
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: RQ_KEY(variables.pageId) });
      const previousComments = queryClient.getQueryData(
        RQ_KEY(variables.pageId),
      );

      // Update cache with optimistic data
      queryClient.setQueryData(
        RQ_KEY(variables.pageId),
        (old: IPagination<IComment>) => {
          if (!old || !old.items) return old;
          const updatedItems = old.items.map((comment) =>
            comment.id === variables.commentId
              ? {
                  ...comment,
                  resolvedAt: variables.resolved ? new Date() : null,
                  resolvedById: variables.resolved ? "optimistic-user" : null,
                  resolvedBy: variables.resolved
                    ? { id: "optimistic-user", name: "Resolving...", avatarUrl: null }
                    : null,
                }
              : comment,
          );
          return { ...old, items: updatedItems };
        },
      );
      return { previousComments };
    },

    // Error Handling
    onError: (err, variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          RQ_KEY(variables.pageId),
          context.previousComments,
        );
      }
      notifications.show({
        message: t("Failed to resolve comment"),
        color: "red",
      });
    },

    // Success Handler
    onSuccess: (data: IComment, variables) => {
      const pageId = data.pageId;
      const currentComments = queryClient.getQueryData(
        RQ_KEY(pageId),
      ) as IPagination<IComment>;

      // Update cache with real data
      if (currentComments && currentComments.items) {
        const updatedComments = currentComments.items.map((comment) =>
          comment.id === variables.commentId
            ? {
                ...comment,
                resolvedAt: data.resolvedAt,
                resolvedById: data.resolvedById,
                resolvedBy: data.resolvedBy,
              }
            : comment,
        );
        queryClient.setQueryData(RQ_KEY(pageId), {
          ...currentComments,
          items: updatedComments,
        });
      }

      // Emit WebSocket event for other clients
      emit({
        operation: "resolveComment",
        pageId: pageId,
        commentId: variables.commentId,
        resolved: variables.resolved,
        resolvedAt: data.resolvedAt,
        resolvedById: data.resolvedById,
        resolvedBy: data.resolvedBy,
      });

      queryClient.invalidateQueries({ queryKey: RQ_KEY(pageId) });
      notifications.show({
        message: variables.resolved
          ? t("Comment resolved successfully")
          : t("Comment re-opened successfully"),
      });
    },
  });
}
```

### 4. API Service

Location: `apps/client/src/features/comment/services/comment-service.ts`

```typescript
export async function resolveComment(data: IResolveComment): Promise<IComment> {
  const req = await api.post<IComment>(`/comments/resolve`, data);
  return req.data;
}
```

### 5. Resolve Component

Location: `apps/client/src/ee/comment/components/resolve-comment.tsx`

```typescript
function ResolveComment({ editor, commentId, pageId, resolvedAt }) {
  const resolveCommentMutation = useResolveCommentMutation();
  const isResolved = resolvedAt != null;

  const handleResolveToggle = async () => {
    await resolveCommentMutation.mutateAsync({
      commentId,
      pageId,
      resolved: !isResolved,
    });

    // Update editor state for inline comment markers
    if (editor) {
      editor.commands.setCommentResolved(commentId, !isResolved);
    }
  };

  return (
    <ActionIcon onClick={handleResolveToggle} loading={resolveCommentMutation.isPending}>
      {isResolved ? <IconCircleCheckFilled /> : <IconCircleCheck />}
    </ActionIcon>
  );
}
```

### 6. WebSocket Subscription

Location: `apps/client/src/features/websocket/use-query-subscription.ts`

```typescript
socket?.on("message", (event) => {
  const data: WebSocketEvent = event;

  switch (data.operation) {
    case "resolveComment": {
      const currentComments = queryClient.getQueryData(
        RQ_KEY(data.pageId),
      ) as IPagination<IComment>;

      if (currentComments && currentComments.items) {
        const updatedComments = currentComments.items.map((comment) =>
          comment.id === data.commentId
            ? {
                ...comment,
                resolvedAt: data.resolvedAt,
                resolvedById: data.resolvedById,
                resolvedBy: data.resolvedBy,
              }
            : comment,
        );

        queryClient.setQueryData(RQ_KEY(data.pageId), {
          ...currentComments,
          items: updatedComments,
        });
      }
      break;
    }
  }
});
```

## Backend Implementation

### 1. DTO (Data Transfer Object)

Location: `apps/server/src/core/comment/dto/resolve-comment.dto.ts`

```typescript
import { IsBoolean, IsUUID } from 'class-validator';

export class ResolveCommentDto {
  @IsUUID()
  commentId: string;

  @IsBoolean()
  resolved: boolean;
}
```

### 2. Service Layer

Location: `apps/server/src/core/comment/comment.service.ts`

```typescript
async resolve(
  comment: Comment,
  resolved: boolean,
  authUser: User,
): Promise<Comment> {
  // Short-circuit if already in desired state
  if (!!comment.resolvedAt === resolved) {
    return comment;
  }

  const resolvedAt = resolved ? new Date() : null;
  const resolvedById = resolved ? authUser.id : null;

  await this.commentRepo.updateComment(
    {
      resolvedAt,
      resolvedById,
      updatedAt: new Date(),
    },
    comment.id,
  );

  comment.resolvedAt = resolvedAt;
  comment.resolvedById = resolvedById;
  comment.updatedAt = new Date();

  return comment;
}
```

**Optimization:** The method includes a short-circuit check to prevent unnecessary database writes when the comment is already in the desired state.

### 3. Controller Layer

Location: `apps/server/src/core/comment/comment.controller.ts`

```typescript
@HttpCode(HttpStatus.OK)
@Post('resolve')
async resolve(@Body() dto: ResolveCommentDto, @AuthUser() user: User) {
  const comment = await this.commentRepo.findById(dto.commentId);
  if (!comment) {
    throw new NotFoundException('Comment not found');
  }

  const ability = await this.spaceAbility.createForUser(
    user,
    comment.spaceId,
  );

  // Permission check: User must have edit permission on the space
  if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
    throw new ForbiddenException();
  }

  return this.commentService.resolve(comment, dto.resolved, user);
}
```

**Permission Model:**
- Uses CASL (Code Access Security Library)
- Requires `SpaceCaslAction.Edit` permission on `SpaceCaslSubject.Page`
- Same permission level as editing or deleting comments

### 4. Repository Layer

Location: `apps/server/src/database/repos/comment/comment.repo.ts`

```typescript
async updateComment(
  updatableComment: UpdatableComment,
  commentId: string,
  trx?: KyselyTransaction,
) {
  const db = dbOrTx(this.db, trx);
  await db
    .updateTable('comments')
    .set(updatableComment)
    .where('id', '=', commentId)
    .execute();
}

async findById(
  commentId: string,
  opts?: { includeCreator: boolean; includeResolvedBy: boolean },
): Promise<Comment> {
  return await this.db
    .selectFrom('comments')
    .selectAll('comments')
    .$if(opts?.includeCreator, (qb) => qb.select(this.withCreator))
    .$if(opts?.includeResolvedBy, (qb) => qb.select(this.withResolvedBy))
    .where('id', '=', commentId)
    .executeTakeFirst();
}
```

**Kysely Relation for Resolver:**
```typescript
withResolvedBy(eb: ExpressionBuilder<DB, 'comments'>) {
  return jsonObjectFrom(
    eb
      .selectFrom('users')
      .select(['users.id', 'users.name', 'users.avatarUrl'])
      .whereRef('users.id', '=', 'comments.resolvedById'),
  ).as('resolvedBy');
}
```

## Complete Data Flow

### Resolve Comment Flow

1. **User Action**
   - User clicks the resolve checkmark icon on a comment
   - `ResolveComment` component triggers `handleResolveToggle()`

2. **Optimistic Update**
   - `useResolveCommentMutation.onMutate` executes
   - React Query cache is updated with optimistic data:
     - `resolvedAt` set to current time
     - `resolvedById` set to "optimistic-user"
     - Comment immediately moves to Resolved tab
   - Previous cache state is stored for potential rollback

3. **Editor State Update**
   - `editor.commands.setCommentResolved(commentId, true)` is called
   - Inline comment marker in the document is updated to show resolved state

4. **API Request**
   - POST request sent to `/api/comments/resolve`
   - Payload: `{ commentId: string, resolved: boolean }`

5. **Backend Processing**
   - Controller validates comment exists
   - CASL checks user permissions
   - Service updates database:
     ```sql
     UPDATE comments
     SET resolvedAt = NOW(),
         resolvedById = 'user-id',
         updatedAt = NOW()
     WHERE id = 'comment-id'
     ```
   - Returns updated comment with resolver information

6. **Success Handling**
   - Mutation replaces optimistic data with real data
   - WebSocket event emitted: `{ operation: "resolveComment", ... }`
   - Success notification displayed
   - Query cache invalidated to ensure fresh data

7. **Real-time Synchronization**
   - Other connected clients receive WebSocket event
   - `useQuerySubscription` updates their local cache
   - Comment moves to appropriate tab on all clients

### Re-open Comment Flow

Same flow as resolve, but:
- `resolved` parameter is `false`
- `resolvedAt` set to `null` in database
- `resolvedById` set to `null`
- Comment moves from Resolved to Open tab

## WebSocket Architecture

### Gateway

Location: `apps/server/src/ws/ws.gateway.ts`

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway implements OnGatewayConnection {
  @SubscribeMessage('message')
  handleMessage(client: Socket, data: any): void {
    // Broadcast to appropriate room
    client.broadcast.emit('message', data);
  }
}
```

### Event Types

The system uses these WebSocket operations:
- `resolveComment` - Notify clients of comment resolution state change
- `invalidateComment` - Invalidate comment queries for refetch

### Room Structure

Clients join rooms based on:
- `user-{userId}` - User-specific updates
- `workspace-{workspaceId}` - Workspace-wide updates
- `space-{spaceId}` - Space-specific updates

## Permission System

### CASL Abilities

The permission system uses these key abilitiess:

| Action | Subject | Description |
|--------|---------|-------------|
| `Create` | `Page` | Create comments on pages |
| `Read` | `Page` | View comments on pages |
| `Edit` | `Page` | Edit, delete, resolve comments |
| `Manage` | `Settings` | Delete any comment (admin) |

### Permission Checks

```typescript
const ability = await this.spaceAbility.createForUser(user, spaceId);

// Example: Check if user can resolve comments
if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
  throw new ForbiddenException();
}
```

## Enterprise Feature Gating

### Frontend Gating

```typescript
const isCloudEE = useIsCloudEE();

// Only show resolve button in EE
{isCloudEE && (
  <ResolveComment ... />
)}
```

### Backend Gating

Currently, the backend doesn't have an explicit EE guard for the resolve endpoint. Permission enforcement is handled by CASL rules. Future implementations could add:

```typescript
@UseGuards(EELicenseGuard)
@Post('resolve')
async resolve(...) { ... }
```

## Error Handling

### Frontend Error Scenarios

1. **API Failure**
   - Optimistic update is reverted using stored previous state
   - Error notification displayed to user
   - Comment returns to original state

2. **Network Timeout**
   - Same rollback mechanism as API failure
   - User can retry the operation

### Backend Error Scenarios

1. **Comment Not Found**
   - Returns 404 NotFoundException
   - Frontend displays error message

2. **Permission Denied**
   - Returns 403 ForbiddenException
   - Frontend shows access denied message

3. **Database Error**
   - Returns 500 Internal Server Error
   - Logged for debugging

## Performance Considerations

### Optimistic Updates

- UI updates immediately without waiting for API response
- Reduces perceived latency
- Provides instant feedback

### Database Optimization

- Short-circuit check prevents unnecessary writes
- Indexed fields on `resolvedAt` for efficient filtering
- Kysely type-safe queries prevent runtime errors

### Cache Management

- React Query cache minimizes API calls
- Selective invalidation refetches only necessary data
- Optimistic updates reduce cache misses

## Testing Considerations

### Unit Tests

- Test `resolve()` service method with various states
- Test permission checks with different user roles
- Test optimistic update rollback logic

### Integration Tests

- Test full flow from UI to database
- Test WebSocket event propagation
- Test concurrent resolve operations

### E2E Tests

- Test user interaction with resolve button
- Test tab switching between Open/Resolved
- Test real-time updates across multiple browsers

## Security Considerations

### Permission Validation

- Server-side permission checks are mandatory
- CASL prevents unauthorized access
- Workspace isolation enforced via `spaceId`

### Input Validation

- `class-validator` ensures type safety
- UUID validation prevents injection attacks
- Boolean validation prevents type confusion

### Data Integrity

- Transaction support for atomic updates
- Optimistic locking prevents race conditions
- Audit trail via `updatedAt` timestamp

## Future Enhancements

1. **Notification System**
   - Email notifications when comments are resolved
   - In-app notifications for @mentions in resolved comments

2. **Batch Operations**
   - Resolve multiple comments at once
   - Bulk re-open for comment threads

3. **Filtering & Search**
   - Filter by resolver
   - Filter by resolution date range
   - Search within resolved comments

4. **Analytics**
   - Track resolution time metrics
   - Identify frequently resolved comment types
   - Team collaboration insights

## Related Files

### Frontend

- `apps/client/src/features/comment/components/comment-list-with-tabs.tsx` - Main UI component
- `apps/client/src/ee/comment/queries/comment-query.ts` - Resolve mutation
- `apps/client/src/ee/comment/components/resolve-comment.tsx` - Resolve button
- `apps/client/src/features/comment/services/comment-service.ts` - API client
- `apps/client/src/hooks/use-is-cloud-ee.tsx` - License check hook
- `apps/client/src/features/websocket/use-query-subscription.ts` - WebSocket handler

### Backend

- `apps/server/src/core/comment/comment.controller.ts` - API endpoints
- `apps/server/src/core/comment/comment.service.ts` - Business logic
- `apps/server/src/core/comment/comment.module.ts` - Module configuration
- `apps/server/src/core/comment/dto/resolve-comment.dto.ts` - DTO definition
- `apps/server/src/database/repos/comment/comment.repo.ts` - Database operations
- `apps/server/src/database/types/db.d.ts` - Type definitions

### Database

- Table: `comments`
- Key fields: `resolvedAt`, `resolvedById`, `updatedAt`
- Indexes: Optimized for filtering by `resolvedAt`

## Email Notification Status

### Current Configuration

**Note:** Email notifications for comments have been temporarily disabled. In-app notifications remain fully functional.

### Affected Email Types

The following email notifications are currently commented out in `apps/server/src/core/notification/services/comment.notification.ts`:

1. **Comment Mention Emails** (`CommentMentionEmail`)
   - Sent when a user is mentioned in a comment
   - Disabled in `processComment()` method (lines 78-88)

2. **Comment Creation Emails** (`CommentCreateEmail`)
   - Sent to page watchers when new comments are added
   - Disabled in `processComment()` method (lines 95-105)

3. **Comment Resolution Emails** (`CommentResolvedEmail`)
   - Sent to comment creators when their comments are resolved
   - Disabled in `processResolved()` method (lines 143-152)

### Active Notification System

✅ **In-app notifications remain active:**
- `COMMENT_USER_MENTION` - Mentions in comments
- `COMMENT_CREATED` - New comments on watched pages
- `COMMENT_RESOLVED` - Comment resolution events

Users will still see notifications in the notification bell, but no emails will be sent.

### Re-enabling Email Notifications

To re-enable email notifications, uncomment the `queueEmail` calls in the three methods mentioned above. Each disabled block includes the original email sending code preserved as comments for easy restoration.

Example restoration:
```typescript
// Remove comment markers to re-enable
await this.notificationService.queueEmail(
  userId,
  notification.id,
  `${actor.name} mentioned you in a comment`,
  CommentMentionEmail({ actorName: actor.name, pageTitle, pageUrl }),
);
```

## Conclusion

The comment resolution feature provides a robust, performant solution for managing comment state in collaborative environments. The implementation leverages optimistic UI updates, real-time synchronization, and proper permission enforcement to deliver a seamless user experience while maintaining data integrity and security.