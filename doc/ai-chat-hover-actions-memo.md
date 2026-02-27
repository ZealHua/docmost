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
RenderHumanGroup
├── [hoveredMessageId state] ← hover state lifted to row level
└── .messageRow.user (flex-direction: row-reverse)
    ├── .avatarWrapper.user
    │   └── CustomAvatar
    └── UserMessageBubble (isHovered prop)
        └── .bubble.user (position: relative)
            ├── .bubbleShimmer (shimmer effect layer)
            ├── .hoverActions (position: absolute; right: 100%)
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
  /* Note: Do NOT use overflow: hidden, it will clip external elements */
}

.hoverActions {
  position: absolute;
  right: 100%;        /* Position outside the left edge of bubble */
  top: 0;
  margin-right: 6px;  /* Gap between actions and bubble */
  /* ... */
}
```

**How it works**: `right: 100%` positions the element outside the parent's left edge, achieving the "outside bubble on the left" effect.

### Shimmer Effect Clipping

Since we removed `overflow: hidden` from `.bubble.user`, we need to handle shimmer clipping separately:

```css
.bubbleShimmer {
  position: absolute;
  inset: 0;              /* Cover entire bubble */
  border-radius: inherit; /* Inherit parent's border-radius */
  overflow: hidden;       /* Clip inner shimmer animation */
  pointer-events: none;
}

.bubbleShimmer::before {
  content: '';
  /* shimmer animation styles */
  animation: sheenPass 4s ease-in-out infinite 0.6s;
}
```

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

1. **Icons not showing**: Check if parent element has `overflow: hidden`
2. **Icons positioned incorrectly**: Ensure `position: relative` is on the correct parent element
3. **Shimmer overflowing**: Use `::before` pseudo-element + `overflow: hidden` wrapper approach
4. **Hover state unstable**: Lift hover state to row level (`.messageRow`) instead of bubble level