import React, { useEffect, useRef, useState } from "react";
import { Box } from "@mantine/core";
import { IconSparkles, IconUser } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import {
  aiIsStreamingAtom,
  aiMessagesAtom,
  aiSourcesAtom,
  aiStreamingContentAtom,
  aiStreamingThinkingAtom,
} from "../store/ai.atoms";
import { AiCitationRenderer } from "./AiCitationRenderer";
import { ThinkingBlock } from "./ThinkingBlock";
import { AiInsightsIcon } from "./AiInsightsIcon";
import { AiMessageCard } from "./AiMessageCard";
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

export function AiMessageList() {
  const { t } = useTranslation();
  const messages = useAtomValue(aiMessagesAtom);
  const isStreaming = useAtomValue(aiIsStreamingAtom);
  const streamingContent = useAtomValue(aiStreamingContentAtom);
  const streamingThinking = useAtomValue(aiStreamingThinkingAtom);
  const sources = useAtomValue(aiSourcesAtom);
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

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <AiInsightsIcon size={80} className={styles.emptyIconLarge} />

          <div className={styles.emptyTitle}>{t('How can I help you?')}</div>
          <div className={styles.emptyDescription}>
            {t("Ask me anything — I'll think it through with you.")}
          </div>

          <div className={styles.emptyChips}>
            <span className={styles.chip}>{t('Summarise a doc')}</span>
            <span className={styles.chip}>{t('Write some code')}</span>
            <span className={styles.chip}>{t('Explain a concept')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Box className={styles.messageContainer}>
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isNew = msg.id === newMessageId;

        return (
          <div
            key={msg.id}
            className={`${styles.messageRow} ${isUser ? styles.user : ""} ${
              isNew ? styles.messageNew : ""
            }`}
          >
            {isUser && (
              <div className={`${styles.avatarWrapper} ${styles.user}`}>
                <div className={styles.avatarRing} />
                <div className={`${styles.avatar} ${styles.user}`}>
                  <IconUser size={13} />
                </div>
              </div>
            )}
            {isUser ? (
              <div className={`${styles.bubble} ${styles.user}`}>
                <span className={styles.bubbleShimmer} />
                {msg.content}
              </div>
            ) : (
              <AiMessageCard header={<AiInsightsIcon showLabel size={16} />}>
                {msg.thinking && (
                  <ThinkingBlock thinking={msg.thinking} isStreaming={false} />
                )}
                <div className={cardStyles.body}>
                  <AiCitationRenderer
                    content={msg.content}
                    sources={msg.sources}
                  />
                </div>
                <div className={`${styles.timestamp} ${styles.assistant}`}>
                  {formatTime(msg.createdAt)}
                </div>
              </AiMessageCard>
            )}
          </div>
        );
      })}

      {isStreaming && (
        <div className={`${styles.messageRow} ${styles.messageNew}`}>
          <AiMessageCard header={<AiInsightsIcon showLabel size={16} />}>
            {streamingThinking && (
              <ThinkingBlock thinking={streamingThinking} isStreaming={true} />
            )}
            {streamingContent ? (
              <div className={cardStyles.body}>
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
