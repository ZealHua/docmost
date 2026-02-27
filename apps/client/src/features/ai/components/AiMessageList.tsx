import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, ActionIcon } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
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
import { ToolCallBlock } from "./ToolCallBlock";
import { SubtaskProgress } from "./SubtaskProgress";
import { groupMessages, MessageGroup } from "../lib/message-grouping";
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

const MAX_LINES = 5;
const LINE_HEIGHT = 22; // Approximate line height in pixels

function UserMessageBubble({
  content,
  messageId,
}: {
  content: string;
  messageId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowExpand, setShouldShowExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      const maxHeight = MAX_LINES * LINE_HEIGHT;
      setShouldShowExpand(height > maxHeight);
    }
  }, [content]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className={`${styles.bubble} ${styles.user}`}>
      <span className={styles.bubbleShimmer} />
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
    </div>
  );
}

function RenderHumanGroup({
  group,
  user,
}: {
  group: Extract<MessageGroup, { type: "human" }>;
  user?: { name?: string; avatarUrl?: string } | null;
}) {
  return (
    <>
      {group.messages.map((msg) => (
        <div
          key={msg.id}
          className={`${styles.messageRow} ${styles.user} ${styles.messageNew}`}
        >
          <div className={`${styles.avatarWrapper} ${styles.user}`}>
            <div className={styles.avatarRing} />
            <div className={`${styles.avatar} ${styles.user}`}>
              <CustomAvatar
                avatarUrl={user?.avatarUrl}
                name={user?.name}
                size={24}
                showOrbitalRing={false}
              />
            </div>
          </div>
          <UserMessageBubble content={msg.content} messageId={msg.id} />
        </div>
      ))}
    </>
  );
}

function RenderAssistantMessageGroup({
  group,
  formatTime,
}: {
  group: Extract<MessageGroup, { type: "assistant:message" }>;
  formatTime: (d: string) => string;
}) {
  return (
    <>
      {group.messages.map((msg) => (
        <div
          key={msg.id}
          className={`${styles.messageRow} ${styles.messageNew}`}
        >
          <AiMessageCard
            header={
              <>
                <AiInsightsIcon showLabel size={16} />
                <AiMemoryStatus />
              </>
            }
          >
            {msg.thinking && (
              <ThinkingBlock thinking={msg.thinking} isStreaming={false} />
            )}
            <div className={cardStyles.body}>
              <AiSourcePreviewBar messageId={msg.id} sources={msg.sources} />
              <AiCitationRenderer content={msg.content} sources={msg.sources} />
            </div>
            <div className={`${styles.timestamp} ${styles.assistant}`}>
              {formatTime(msg.createdAt)}
            </div>
          </AiMessageCard>
        </div>
      ))}
    </>
  );
}

function RenderProcessingGroup({
  group,
  formatTime,
}: {
  group: Extract<MessageGroup, { type: "assistant:processing" }>;
  formatTime: (d: string) => string;
}) {
  const { triggerMessage, toolResponses, resultMessage } = group;

  return (
    <div className={`${styles.messageRow} ${styles.messageNew}`}>
      <AiMessageCard
        header={
          <>
            <AiInsightsIcon showLabel size={16} />
            <AiMemoryStatus />
          </>
        }
      >
        {/* Tool calls */}
        {triggerMessage.tool_calls?.map((tc) => {
          const response = toolResponses.find((r) => r.tool_call_id === tc.id);
          return (
            <ToolCallBlock
              key={tc.id}
              toolCall={tc}
              result={response?.content}
              status={
                response
                  ? response.tool_status === "error"
                    ? "error"
                    : "success"
                  : "running"
              }
            />
          );
        })}

        {/* Final response text */}
        {resultMessage && (
          <div className={cardStyles.body}>
            <AiCitationRenderer
              content={resultMessage.content}
              sources={resultMessage.sources}
            />
          </div>
        )}

        <div className={`${styles.timestamp} ${styles.assistant}`}>
          {formatTime(triggerMessage.createdAt)}
        </div>
      </AiMessageCard>
    </div>
  );
}

function RenderPresentFilesGroup({
  group,
  formatTime,
}: {
  group: Extract<MessageGroup, { type: "assistant:present-files" }>;
  formatTime: (d: string) => string;
}) {
  const lastMsg = group.messages[group.messages.length - 1];
  return (
    <div className={`${styles.messageRow} ${styles.messageNew}`}>
      <AiMessageCard
        header={
          <>
            <AiInsightsIcon showLabel size={16} />
            <AiMemoryStatus />
          </>
        }
      >
        <div className={cardStyles.body}>
          {lastMsg.content && (
            <AiCitationRenderer
              content={lastMsg.content}
              sources={lastMsg.sources}
            />
          )}
          {group.files.length > 0 && (
            <div className={styles.filesList}>
              {group.files.map((file, idx) => (
                <div key={idx} className={styles.fileChip}>
                  📄 {file.split("/").pop()}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`${styles.timestamp} ${styles.assistant}`}>
          {formatTime(lastMsg.createdAt)}
        </div>
      </AiMessageCard>
    </div>
  );
}

function RenderClarificationGroup({
  group,
  formatTime,
}: {
  group: Extract<MessageGroup, { type: "assistant:clarification" }>;
  formatTime: (d: string) => string;
}) {
  const msg = group.messages[0];
  return (
    <div className={`${styles.messageRow} ${styles.messageNew}`}>
      <AiMessageCard
        header={
          <>
            <AiInsightsIcon showLabel size={16} />
            <span className={styles.clarificationBadge}>Clarification</span>
          </>
        }
      >
        <div className={cardStyles.body}>
          <AiCitationRenderer content={msg.content} sources={msg.sources} />
        </div>
        <div className={`${styles.timestamp} ${styles.assistant}`}>
          {formatTime(msg.createdAt)}
        </div>
      </AiMessageCard>
    </div>
  );
}

function RenderGroup({
  group,
  formatTime,
  user,
}: {
  group: MessageGroup;
  formatTime: (d: string) => string;
  user?: { name?: string; avatarUrl?: string } | null;
}) {
  switch (group.type) {
    case "human":
      return <RenderHumanGroup group={group} user={user} />;
    case "assistant:message":
      return (
        <RenderAssistantMessageGroup group={group} formatTime={formatTime} />
      );
    case "assistant:processing":
      return <RenderProcessingGroup group={group} formatTime={formatTime} />;
    case "assistant:present-files":
      return <RenderPresentFilesGroup group={group} formatTime={formatTime} />;
    case "assistant:clarification":
      return <RenderClarificationGroup group={group} formatTime={formatTime} />;
    case "assistant:subagent":
      // Subagent tasks are shown inline via SubtaskProgress during streaming
      return (
        <RenderAssistantMessageGroup
          group={{ ...group, type: "assistant:message" }}
          formatTime={formatTime}
        />
      );
    default:
      return null;
  }
}

export function AiMessageList() {
  const { t } = useTranslation();
  const messages = useAtomValue(aiMessagesAtom);
  const isStreaming = useAtomValue(aiIsStreamingAtom);
  const streamingContent = useAtomValue(aiStreamingContentAtom);
  const streamingThinking = useAtomValue(aiStreamingThinkingAtom);
  const sources = useAtomValue(aiSourcesAtom);
  const currentUser = useAtomValue(currentUserAtom);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);

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

  // Group messages for richer rendering
  const groups = groupMessages(messages);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <AiInsightsIcon size={80} className={styles.emptyIconLarge} />

          <div className={styles.emptyTitle}>{t("How can I help you?")}</div>
          <div className={styles.emptyDescription}>
            {t("Ask me anything — I'll think it through with you.")}
          </div>

          <div className={styles.emptyChips}>
            <span className={styles.chip}>{t("Summarise a doc")}</span>
            <span className={styles.chip}>{t("Write some code")}</span>
            <span className={styles.chip}>{t("Search Internet")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Box className={styles.messageContainer}>
      {groups.map((group) => (
        <RenderGroup
          key={group.id}
          group={group}
          formatTime={formatTime}
          user={currentUser?.user}
        />
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
            {/* Subtask progress during streaming */}
            <SubtaskProgress />
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
