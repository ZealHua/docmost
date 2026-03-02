# AI Chat Hover Actions Technical Memo

## Overview

Added hover action buttons (Copy + Edit & Resend) to AI Chat user messages, positioned outside the message bubble on the left side, with backend message synchronization.

---

## Features

1. **Copy Button** - Displayed on hover for all user messages
2. **Edit & Resend Button** - Only shown on the latest user message; allows editing content and resending to AI
3. **Backend Sync** - When editing and resending, truncates all messages after the edited one to maintain frontend-backend consistency

---

## Component Structure

```
AiMessageList
├── [hoveredMessageId state] ← hover state lifted to row level
└── .messageRow.user (flex-direction: row-reverse)
    ├── .avatarWrapper.user
    │   └── CustomAvatar
    └── UserMessageBubble (isHovered prop)
        └── .bubble.user (position: relative; NO overflow: hidden)
            ├── .shimmerContainer (position: absolute; inset: 0; overflow: hidden)
            │   └── .bubbleShimmer (shimmer animation)
            ├── .hoverActions (position: absolute; right: 100%; visible on hover)
            │   ├── Copy ActionIcon
            │   └── Edit ActionIcon (latest message only)
            └── content
```

---

## Key CSS Positioning

### Positioning Outside the Bubble (Left Side)

```css
.bubble.user {
  position: relative;  /* Reference point for hoverActions */
  /* IMPORTANT: No overflow: hidden here - it would clip absolutely positioned children */
}

.hoverActions {
  position: absolute;
  right: 100%;        /* Position outside the left edge of bubble */
  top: 0;
  margin-right: 6px;  /* Gap between actions and bubble */
  animation: hoverActionsSlideIn 0.15s ease forwards;
}

@keyframes hoverActionsSlideIn {
  from {
    opacity: 0;
    transform: translateX(4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

**How it works**: `right: 100%` positions the element outside the parent's left edge, achieving the "outside bubble on the left" effect.

**Critical Note**: The `.bubble.user` container must NOT have `overflow: hidden`. When an element has both `position: relative` and `overflow: hidden`, it becomes the containing block for absolutely positioned children, and those children will be clipped if they extend outside the parent's bounds. Since `.hoverActions` is positioned with `right: 100%`, it sits completely outside the bubble and would be invisible if `overflow: hidden` were present.

### Shimmer Effect Clipping

The shimmer animation needs to be clipped within the bubble's rounded corners, but we can't use `overflow: hidden` on `.bubble.user` because it would clip the hover actions. Instead, we use a dedicated container:

```css
.shimmerContainer {
  position: absolute;
  inset: 0;
  overflow: hidden;  /* Clip shimmer to bubble bounds */
  border-radius: 14px;
  border-bottom-right-radius: 4px;
  pointer-events: none;
}

.bubbleShimmer {
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 60%
  );
  animation: sheenPass 4s ease-in-out infinite 0.6s;
  pointer-events: none;
}

@keyframes sheenPass {
  0%   { left: -75%; opacity: 0; }
  10%  { opacity: 1; }
  45%  { left: 125%;  opacity: 1; }
  50%, 100% { left: 125%; opacity: 0; }
}
```

**Component Structure**:
```tsx
<div className={`${styles.bubble} ${styles.user}`}>
  <span className={styles.shimmerContainer}>
    <span className={styles.bubbleShimmer} />
  </span>

  {/* Hover actions - positioned outside the bubble on the left */}
  {isHovered && !isEditing && (
    <div className={styles.hoverActions}>
      {/* Action buttons */}
    </div>
  )}

  {/* Message content */}
</div>
```

This separation of concerns allows:
- Hover actions to be positioned outside the bubble without clipping
- Shimmer animation to be properly clipped within the bubble's rounded corners
- Both effects to work together without interference

---

## Backend Truncate API

### Request

```
DELETE /ai/sessions/:sessionId/messages/:messageId/truncate
```

### Logic

1. Find message by `messageId` to get `createdAt` timestamp
2. Delete all messages in the session where `createdAt >= timestamp`
3. Return 204 No Content

### Repository Method

```typescript
// apps/server/src/ai/repos/ai-message.repo.ts
async deleteFromTimestamp(sessionId: string, fromCreatedAt: Date): Promise<void> {
  await this.db
    .deleteFrom('aiMessages')
    .where('sessionId', '=', sessionId)
    .where('createdAt', '>=', fromCreatedAt)
    .execute();
}
```

---

## Frontend Hook Method

```typescript
// apps/client/src/features/ai/hooks/use-ai-chat.ts
const editAndResendMessage = async (messageId: string, newContent: string) => {
  // 1. Call truncate API to delete the message and all following messages
  await truncateMessages(sessionId, messageId);
  
  // 2. Update local state (remove truncated messages)
  // 3. Send new message content to AI
  sendMessage(newContent);
};
```

---

## CSS Modules Notes

### Compound Selector Issue

In CSS Modules, compound selectors like `.messageRow.user` do not export the `.user` class name.

**Wrong approach**:
```tsx
// ❌ styles.user doesn't exist
<div className={`${styles.messageRow} ${styles.user}`}>
```

**Correct approach**:
```css
/* Use a single class name */
.messageRowUser {
  /* ... */
}
```

Or handle style composition in TSX using template strings.

---

## File Changes

| File | Changes |
|------|---------|
| `apps/client/src/features/ai/components/AiMessageList.tsx` | Added UserMessageBubble component, hover logic, edit functionality |
| `apps/client/src/features/ai/components/AiMessageList.module.css` | Added hoverActions styles, fixed shimmer clipping |
| `apps/client/src/features/ai/hooks/use-ai-chat.ts` | Added editAndResendMessage method |
| `apps/client/src/features/ai/services/ai-chat.service.ts` | Added truncateMessages API function |
| `apps/client/src/features/ai/pages/AiPage.tsx` | Passed onEditAndResend callback |
| `apps/server/src/ai/ai.controller.ts` | Added truncate endpoint |
| `apps/server/src/ai/repos/ai-message.repo.ts` | Added deleteFromTimestamp method |

---

## Debugging Tips

1. **Hover actions not showing**: Check that `.bubble.user` does NOT have `overflow: hidden`. The hover actions are positioned with `right: 100%` which places them outside the bubble bounds. If the parent has both `position: relative` and `overflow: hidden`, the absolutely positioned children will be clipped.

2. **Icons positioned incorrectly**: Ensure `position: relative` is on `.bubble.user` (the correct parent) and that `.hoverActions` has `right: 100%` to position it outside the left edge.

3. **Shimmer overflowing bubble**: Ensure the shimmer is wrapped in a dedicated `.shimmerContainer` with `overflow: hidden` and the correct border-radius values (14px with 4px bottom-right corner).

4. **Hover state unstable**: Lift hover state to row level (`.messageRow`) instead of bubble level. Use `onMouseEnter` and `onMouseLeave` on the message row to set `hoveredMessageId` state.

5. **Animation not playing**: Check that the `hoverActionsSlideIn` animation is defined and that the element is being rendered (check `isHovered && !isEditing` condition).

6. **Buttons clipped by other elements**: Verify no parent elements above `.bubble.user` have `overflow: hidden` that would clip the positioned elements.