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
import { AiSourceDrawer } from '../components/AiSourceDrawer';
import { ArtifactPanel } from '../components/artifacts/artifact-panel';
import { ArtifactHeaderButton } from '../components/artifacts/artifact-header';
import { ArtifactsProvider } from '../context/artifacts-context';
import { useAiSessions } from '../hooks/use-ai-sessions';
import { useAiChat } from '../hooks/use-ai-chat';
import { useAiPageSearch } from '../hooks/use-ai-page-search';
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

  const pageSearch = useAiPageSearch();

  const restoreSelectedPages = async (selectedPageIds: string[]) => {
    if (!selectedPageIds || selectedPageIds.length === 0) {
      setSelectedPages([]);
      return;
    }
    try {
      const pages = await pageSearch.mutateAsync({ pageIds: selectedPageIds, spaceId: '' });
      setSelectedPages(pages);
    } catch (error) {
      console.error('Failed to restore selected pages:', error);
      setSelectedPages([]);
    }
  };

  const createLocalSession = (): AiSession => ({
    id: `local-${crypto.randomUUID()}`,
    workspaceId: workspaceId || '',
    pageId: null,
    userId: '',
    title: 'New Chat',
    selectedPageIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    // Create a local-only session when visiting Intelligence page
    // It won't be persisted until user sends a message
    if (!activeSession) {
      const localSession = createLocalSession();
      setActiveSessionAtom(localSession);
      setSelectedPages([]);
      clearMessages();
    }
  }, [sessions, activeSession, setSession, loadSessionMessages, setMessages]);

  // An "empty" session already exists if there's an active session with no messages yet.
  const isEmptySession = !!activeSession && messages.length === 0;

  const handleNewChat = () => {
    // Don't create another session when the current one hasn't received any user input yet.
    if (isEmptySession) return;
    // Create a local session (will be persisted when user sends first message)
    const newSession = createLocalSession();
    setActiveSessionAtom(newSession);
    clearMessages();
    setSelectedPages([]);
    setHistoryOpen(false);
  };

  const handleSelectSession = (session: AiSession) => {
    setSession(session);
    clearMessages();
    
    // Restore selected pages immediately from session data
    if (session.selectedPageIds && session.selectedPageIds.length > 0) {
      restoreSelectedPages(session.selectedPageIds);
    } else {
      setSelectedPages([]);
    }
    
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

      <ArtifactsProvider>
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

              <ArtifactHeaderButton />

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

          <ArtifactPanel sessionId={activeSession?.id || ''}>
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
          </ArtifactPanel>
          
          {/* Global Overlays */}
          <AiSourceDrawer />
        </Box>
      </ArtifactsProvider>
    </>
  );
}
