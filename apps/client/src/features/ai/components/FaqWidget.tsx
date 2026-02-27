import React, { useRef, useEffect } from 'react';
import { ActionIcon, Popover, TextInput, Tooltip, Box, ScrollArea, Group } from '@mantine/core';
import { IconHelp, IconSend, IconRobot, IconUser } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useFaqChat } from '../hooks/use-faq-chat';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './FaqWidget.module.css';

export function FaqWidget() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  
  // Actually, we need workspaceId for RAG. 
  // We can fetch it or just rely on the active workspace in the context.
  // In docmost, spaceSlug is usually enough for navigation, but let's try to pass the workspace id if needed.
  // We'll leave workspaceId undefined for now, assuming the backend can use AuthWorkspace() decorator
  // which implies we don't strictly need to pass it in the frontend hook if the endpoint gets it from AuthWorkspace().
  const { messages, isStreaming, sendMessage } = useFaqChat('active-workspace');

  const [opened, setOpened] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const viewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isStreaming) return;
    sendMessage(query);
    setQuery('');
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      shadow="xl"
      offset={4}
      width={380}
    >
      <Popover.Target>
        <Tooltip label={t('FAQ Assistant')} openDelay={250} withArrow>
          <ActionIcon
            variant="subtle"
            color="violet"
            onClick={() => setOpened((o) => !o)}
          >
            <IconHelp size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p={0} className={styles.dropdown}>
        <Box className={styles.header}>
          <Group gap="xs">
            <IconHelp size={16} className={styles.headerIcon} />
            <span className={styles.headerTitle}>{t('FAQ Assistant')}</span>
          </Group>
        </Box>

        <ScrollArea viewportRef={viewportRef} className={styles.messagesArea}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <IconRobot size={32} className={styles.emptyIcon} />
              <div className={styles.emptyText}>
                {t('Ask me anything about OpenMemo features, tips, or how to get started.')}
              </div>
            </div>
          ) : (
            <div className={styles.messagesList}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}
                >
                  <div className={`${styles.avatar} ${msg.role === 'user' ? styles.userAvatar : styles.assistantAvatar}`}>
                    {msg.role === 'user' ? <IconUser size={14} /> : <IconRobot size={14} />}
                  </div>
                  <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                    {msg.role === 'assistant' ? (
                      isStreaming && !msg.content ? (
                        <span className={styles.typingDot} />
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      )
                    ) : (
                      msg.content
                    )}
                    
                    {/* Tiny source indicators */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className={styles.sources}>
                        {msg.sources.map((s, i) => (
                          <div key={i} className={styles.sourceChip}>
                            📄 {s.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className={styles.inputArea}>
          <TextInput
            placeholder={t('Ask a question...')}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            disabled={isStreaming}
            size="sm"
            radius="md"
            rightSection={
              <ActionIcon
                type="submit"
                variant="filled"
                color="violet"
                size="sm"
                radius="xl"
                disabled={!query.trim() || isStreaming}
              >
                <IconSend size={14} />
              </ActionIcon>
            }
          />
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}
