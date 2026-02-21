import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mantine/core';
import { IconSparkles, IconUser } from '@tabler/icons-react';
import { useAtomValue } from 'jotai';
import {
  aiIsStreamingAtom,
  aiMessagesAtom,
  aiSourcesAtom,
  aiStreamingContentAtom,
  aiStreamingThinkingAtom,
} from '../store/ai.atoms';
import { AiCitationRenderer } from './AiCitationRenderer';
import { ThinkingBlock } from './ThinkingBlock';
import { useTranslation } from 'react-i18next';
import styles from './AiMessageList.module.css';

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isStreaming]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (messages.length === 0 && !isStreaming) {
    return (
      <Box className={styles.emptyState}>
        <Box className={styles.emptyStateContent}>
          <div className={styles.emptyIcon}>
            <IconSparkles size={24} />
          </div>
          <div className={styles.emptyTitle}>{t('How can I help you today?')}</div>
          <div className={styles.emptyDescription}>
            {t('Ask questions about your workspace content. AI answers are grounded in your pages.')}
          </div>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.messageContainer}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const isNew = msg.id === newMessageId;

        return (
          <div
            key={msg.id}
            className={`${styles.messageRow} ${isUser ? styles.user : ''} ${
              isNew ? styles.messageNew : ''
            }`}
          >
            <div className={`${styles.avatar} ${isUser ? styles.user : styles.assistant}`}>
              {isUser ? <IconUser size={14} /> : <IconSparkles size={14} />}
            </div>
            {isUser ? (
              <div className={`${styles.bubble} ${styles.user}`}>
                {msg.content}
              </div>
            ) : (
              <div className={styles.assistantContent}>
                {msg.thinking && (
                  <ThinkingBlock thinking={msg.thinking} isStreaming={false} />
                )}
                <AiCitationRenderer content={msg.content} sources={msg.sources} />
                <div className={`${styles.timestamp} ${styles.assistant}`}>
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {isStreaming && (
        <div className={`${styles.messageRow} ${styles.messageNew}`}>
          <div className={`${styles.avatar} ${styles.assistant}`}>
            <IconSparkles size={14} />
          </div>
          <div className={styles.assistantContent}>
            {streamingThinking && (
              <ThinkingBlock thinking={streamingThinking} isStreaming={true} />
            )}
            {streamingContent ? (
              <AiCitationRenderer content={streamingContent} sources={sources} />
            ) : !streamingThinking && (
              <TypingIndicator />
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </Box>
  );
}
