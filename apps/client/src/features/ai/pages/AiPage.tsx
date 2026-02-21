import React, { useEffect, useState } from 'react';
import { Box, Loader, Center } from '@mantine/core';
import { IconPlus, IconHistory } from '@tabler/icons-react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { getAppName } from '@/lib/config';
import { useTranslation } from 'react-i18next';
import { workspaceAtom } from '@/features/user/atoms/current-user-atom';
import { AiMessageList } from '../components/AiMessageList';
import { AiMessageInput } from '../components/AiMessageInput';
import { AiHistoryPanel } from '../components/AiHistoryPanel';
import { useAiSessions } from '../hooks/use-ai-sessions';
import { useAiChat } from '../hooks/use-ai-chat';
import { aiActiveSessionAtom, aiMessagesAtom, aiSelectedPagesAtom } from '../store/ai.atoms';
import { AiSession } from '../types/ai-chat.types';
import styles from './AiPage.module.css';

export default function AiPage() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const [workspace] = useAtom(workspaceAtom);
  const workspaceId = workspace?.id;

  const { sessions, isLoading: sessionsLoading, createSession, deleteSession, renameSession, loadSessionMessages } =
    useAiSessions(workspaceId);
  const { stopStream, clearMessages, setSession, activeSession } = useAiChat(workspaceId);
  const [messages, setMessages] = useAtom(aiMessagesAtom);
  const [, setActiveSessionAtom] = useAtom(aiActiveSessionAtom) as readonly [AiSession | null, (val: AiSession | null) => void];
  const [, setSelectedPages] = useAtom(aiSelectedPagesAtom);

  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      const latestSession = sessions[0];
      setSession(latestSession);
      loadSessionMessages(latestSession.id).then((data) => {
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            sessionId: m.sessionId,
            role: m.role,
            content: m.content,
            sources: m.sources || [],
            createdAt: m.createdAt,
          })),
        );
      });
    }
  }, [sessions, activeSession, setSession, loadSessionMessages, setMessages]);

  // An "empty" session already exists if there's an active session with no messages yet.
  const isEmptySession = !!activeSession && messages.length === 0;

  const handleNewChat = () => {
    // Don't create another session when the current one hasn't received any user input yet.
    if (isEmptySession) return;
    createSession(undefined).then((newSession) => {
      setActiveSessionAtom(newSession);
      clearMessages();
      setSelectedPages([]);
      setHistoryOpen(false);
    });
  };

  const handleSelectSession = (session: AiSession) => {
    setSession(session);
    clearMessages();
    loadSessionMessages(session.id).then((data) => {
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role,
          content: m.content,
          sources: m.sources || [],
          createdAt: m.createdAt,
        })),
      );
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId).then(() => {
      if (activeSession?.id === sessionId) {
        clearMessages();
        setActiveSessionAtom(null);
      }
    });
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    renameSession({ sessionId, title });
  };

  if (sessionsLoading) {
    return (
      <Center style={{ height: '100%' }}>
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>AI - {getAppName()}</title>
      </Helmet>

      <Box className={styles.container}>
        {/* Header */}
        <Box className={styles.header}>
          <div className={styles.headerControls}>
            <button
              className={styles.iconButton}
              onClick={handleNewChat}
              title={t('New chat')}
              disabled={isEmptySession}
              style={isEmptySession ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              <IconPlus size={18} />
            </button>

            <button
              className={styles.iconButton}
              onClick={() => setHistoryOpen((o) => !o)}
              title={t('History')}
            >
              <IconHistory size={18} />
            </button>

            <AiHistoryPanel
              open={historyOpen}
              onClose={() => setHistoryOpen(false)}
              sessions={sessions}
              activeSessionId={activeSession?.id}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
            />
          </div>
        </Box>

        {/* Scrollable message list */}
        <Box className={styles.messageArea}>
          <Box className={styles.messageAreaInner}>
            <AiMessageList />
          </Box>
        </Box>

        {/* Input bar */}
        <Box className={styles.inputArea}>
          <Box className={styles.inputInner}>
            <AiMessageInput workspaceId={workspaceId} />
            <div className={styles.footerNote}>
              {t('AI may make mistakes. Always verify important information.')}
            </div>
          </Box>
        </Box>
      </Box>
    </>
  );
}
