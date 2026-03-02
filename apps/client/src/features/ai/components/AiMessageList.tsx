import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, ActionIcon, Tooltip, Textarea, Button, Group } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconCopy, IconPencil, IconRefresh } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import {
  aiIsStreamingAtom,
  aiMessagesAtom,
  aiSourcesAtom,
  aiStreamingContentAtom,
  aiStreamingThinkingAtom,
} from "../store/ai.atoms";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AiCitationRenderer } from "./AiCitationRenderer";
import { AiSourcePreviewBar } from "./AiSourcePreviewBar";
import { ThinkingBlock } from "./ThinkingBlock";
import { AiInsightsIcon } from "./AiInsightsIcon";
import { AiMessageCard } from "./AiMessageCard";
import { AiMemoryStatus } from "./AiMemoryStatus";
import { useTranslation } from "react-i18next";
import styles from "./AiMessageList.module.css";
import cardStyles from "./AiMessageCard.module.css";

function TypingIndicator() {
  return (
    <div className={styles.typingContainer}>
      <div className={styles.typingDot} />
      <div className={styles.typingDot} />
      <div className={styles.typingDot} />
    </div>
  );
}

function AiMessageFooter({
  content,
  timestamp,
  isLatest,
  onRegenerate,
}: {
  content: string;
  timestamp: string;
  isLatest: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className={cardStyles.footerRow}>
      <div className={cardStyles.footerActions}>
        <Tooltip label={copied ? "Copied!" : "Copy"} withArrow position="top">
          <ActionIcon
            size="xs"
            variant="subtle"
            onClick={handleCopy}
            className={cardStyles.footerActionBtn}
            aria-label="Copy message"
          >
            <IconCopy size={14} />
          </ActionIcon>
        </Tooltip>
        {isLatest && onRegenerate && (
          <Tooltip label="Regenerate" withArrow position="top">
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={onRegenerate}
              className={cardStyles.footerActionBtn}
              aria-label="Regenerate response"
            >
              <IconRefresh size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
      <div className={cardStyles.footerTimestamp}>{timestamp}</div>
    </div>
  );
}

const MAX_LINES = 5;
const LINE_HEIGHT = 22; // Approximate line height in pixels

function UserMessageBubble({
  content,
  messageId,
  isLatest,
  onEditAndResend,
  isHovered,
}: {
  content: string;
  messageId: string;
  isLatest?: boolean;
  onEditAndResend?: (messageId: string, newContent: string) => void;
  isHovered?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowExpand, setShouldShowExpand] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      const maxHeight = MAX_LINES * LINE_HEIGHT;
      setShouldShowExpand(height > maxHeight);
    }
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isEditing]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleStartEdit = useCallback(() => {
    setEditContent(content);
    setIsEditing(true);
  }, [content]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(content);
    setIsEditing(false);
  }, [content]);

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && editContent !== content) {
      onEditAndResend?.(messageId, editContent);
    }
    setIsEditing(false);
  }, [editContent, content, messageId, onEditAndResend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSaveEdit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit],
  );

  return (
    <div className={`${styles.bubble} ${styles.user}`}>
      <div className={styles.shimmerContainer}>
        <span className={styles.bubbleShimmer} />
      </div>

      {/* Hover actions - positioned outside the bubble on the left */}
      {isHovered && !isEditing && (
        <div className={styles.hoverActions}>
          <Tooltip label={copied ? "Copied!" : "Copy"} withArrow position="top">
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={handleCopy}
              className={styles.actionButton}
              aria-label="Copy message"
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
          {isLatest && onEditAndResend && (
            <Tooltip label="Edit & Resend" withArrow position="top">
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={handleStartEdit}
                className={styles.actionButton}
                aria-label="Edit and resend"
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
      )}

      {isEditing ? (
        <div className={styles.editContainer}>
          <Textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            autosize
            minRows={2}
            maxRows={8}
            className={styles.editTextarea}
          />
          <Group gap={8} mt={8} justify="flex-end">
            <Button size="xs" variant="subtle" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button size="xs" onClick={handleSaveEdit}>
              Send
            </Button>
          </Group>
        </div>
      ) : (
        <>
          <div
            ref={contentRef}
            className={`${styles.bubbleContent} ${!isExpanded && shouldShowExpand ? styles.collapsed : ""}`}
          >
            {content}
          </div>

          {shouldShowExpand && (
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={toggleExpand}
              className={styles.expandButton}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <IconChevronUp size={14} />
              ) : (
                <IconChevronDown size={14} />
              )}
            </ActionIcon>
          )}
        </>
      )}
    </div>
  );
}

export function AiMessageList({
  onEditAndResend,
  onRegenerate,
}: {
  onEditAndResend?: (messageId: string, newContent: string) => void;
  onRegenerate?: (messageId: string) => void;
} = {}) {
  const { t } = useTranslation();
  const messages = useAtomValue(aiMessagesAtom);
  const isStreaming = useAtomValue(aiIsStreamingAtom);
  const streamingContent = useAtomValue(aiStreamingContentAtom);
  const streamingThinking = useAtomValue(aiStreamingThinkingAtom);
  const sources = useAtomValue(aiSourcesAtom);
  const currentUser = useAtomValue(currentUserAtom);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setNewMessageId(lastMsg.id);
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isStreaming]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Find the latest user message ID
  const latestUserMessageId = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.id;

  // Find the latest assistant message ID
  const latestAssistantMessageId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <AiInsightsIcon size={80} className={styles.emptyIconLarge} />

          <div className={styles.emptyTitle}>{t("How can I help you?")}</div>
          <div className={styles.emptyDescription}>
            {t("Ask me anything — I'll think it through with you.")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Box className={styles.messageContainer}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`${styles.messageRow} ${message.role === "user" ? styles.user : ""} ${styles.messageNew}`}
          onMouseEnter={message.role === "user" ? () => setHoveredMessageId(message.id) : undefined}
          onMouseLeave={message.role === "user" ? () => setHoveredMessageId(null) : undefined}
        >
          {message.role === "user" ? (
            <>
              <div className={`${styles.avatarWrapper} ${styles.user}`}>
                <div className={styles.avatarRing} />
                <div className={`${styles.avatar} ${styles.user}`}>
                  <CustomAvatar
                    avatarUrl={currentUser?.user?.avatarUrl}
                    name={currentUser?.user?.name}
                    size={24}
                    showOrbitalRing={false}
                  />
                </div>
              </div>
              <UserMessageBubble
                content={message.content}
                messageId={message.id}
                isLatest={message.id === latestUserMessageId}
                onEditAndResend={onEditAndResend}
                isHovered={hoveredMessageId === message.id}
              />
            </>
          ) : (
            <AiMessageCard
              header={
                <>
                  <AiInsightsIcon showLabel size={16} />
                  <AiMemoryStatus />
                </>
              }
              footer={
                <AiMessageFooter
                  content={message.content}
                  timestamp={formatTime(message.createdAt)}
                  isLatest={message.id === latestAssistantMessageId}
                  onRegenerate={
                    message.id === latestAssistantMessageId
                      ? () => onRegenerate?.(message.id)
                      : undefined
                  }
                />
              }
            >
              {message.thinking && (
                <ThinkingBlock thinking={message.thinking} isStreaming={false} />
              )}
              <div className={cardStyles.body}>
                <AiSourcePreviewBar messageId={message.id} sources={message.sources} />
                <AiCitationRenderer content={message.content} sources={message.sources} />
              </div>
            </AiMessageCard>
          )}
        </div>
      ))}

      {isStreaming && (
        <div className={`${styles.messageRow} ${styles.messageNew}`}>
          <AiMessageCard
            header={
              <>
                <AiInsightsIcon showLabel size={16} />
                <AiMemoryStatus />
              </>
            }
          >
            {streamingThinking && (
              <ThinkingBlock thinking={streamingThinking} isStreaming={true} />
            )}
            {streamingContent ? (
              <div className={cardStyles.body}>
                <AiSourcePreviewBar messageId="streaming" sources={sources} />
                <AiCitationRenderer
                  content={streamingContent}
                  sources={sources}
                />
              </div>
            ) : (
              !streamingThinking && <TypingIndicator />
            )}
          </AiMessageCard>
        </div>
      )}

      <div ref={bottomRef} />
    </Box>
  );
}
