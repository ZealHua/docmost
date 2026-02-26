import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Loader, Center } from '@mantine/core';
import { IconPlus, IconHistory } from '@tabler/icons-react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { getAppName } from '@/lib/config';
import { useTranslation } from 'react-i18next';
import { workspaceAtom } from '@/features/user/atoms/current-user-atom';
import { getLangGraphClient } from '@/lib/langgraph-client';
import { AiMessageList } from '../components/AiMessageList';
import { AiMessageInput } from '../components/AiMessageInput';
import { AiHistoryPanel } from '../components/AiHistoryPanel';
import { AiSourceDrawer } from '../components/AiSourceDrawer';
import { ArtifactPanel } from '../components/artifacts/artifact-panel';
import { ArtifactHeaderButton } from '../components/artifacts/artifact-header';
import { ArtifactsProvider, useArtifacts } from '../context/artifacts-context';
import { useAiSessions } from '../hooks/use-ai-sessions';
import { useAiChat } from '../hooks/use-ai-chat';
import { useAiPageSearch } from '../hooks/use-ai-page-search';
import { aiActiveSessionAtom, aiMessagesAtom, aiSelectedPagesAtom, aiThreadIdAtom, aiDesignModeAtom } from '../store/ai.atoms';
import { AiSession } from '../types/ai-chat.types';
import styles from './AiPage.module.css';

export default function AiPage() {
  const { t } = useTranslation();
  const { spaceSlug, sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const [workspace] = useAtom(workspaceAtom);
  const workspaceId = workspace?.id;

  const { sessions, isLoading: sessionsLoading, createSession, deleteSession, renameSession, loadSessionMessages } =
    useAiSessions(workspaceId);
  const { stopStream, clearMessages, setSession, activeSession } = useAiChat(workspaceId);
  const [messages, setMessages] = useAtom(aiMessagesAtom);
  const [, setActiveSessionAtom] = useAtom(aiActiveSessionAtom) as readonly [AiSession | null, (val: AiSession | null) => void];
  const [, setThreadId] = useAtom(aiThreadIdAtom) as readonly [string | null, (val: string | null) => void];
  const [, setDesignMode] = useAtom(aiDesignModeAtom);
  const [, setSelectedPages] = useAtom(aiSelectedPagesAtom);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingArtifacts, setPendingArtifacts] = useState<string[] | null>(null);
  // Guard: prevent double-restoring when the URL param hasn't changed
  const restoredSessionRef = useRef<string | null>(null);

  const pageSearch = useAiPageSearch();

  /** Navigate helper — updates the URL to include/exclude the session ID */
  const navigateToSession = useCallback(
    (id?: string) => {
      const base = `/s/${spaceSlug}/ai`;
      navigate(id ? `${base}/${id}` : base, { replace: true });
    },
    [spaceSlug, navigate],
  );

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

  // ── Restore session from URL param on mount / URL change ──────────
  useEffect(() => {
    // If the URL has a sessionId and we haven't restored it yet, load it
    if (urlSessionId && urlSessionId !== restoredSessionRef.current && !sessionsLoading) {
      restoredSessionRef.current = urlSessionId;
      // Find the session in the loaded list (if available)
      const found = sessions.find((s) => s.id === urlSessionId);
      if (found) {
        handleSelectSession(found, /* skipNavigate */ true);
      } else {
        // Session not in the list — try loading directly by ID
        loadSessionMessages(urlSessionId)
          .then((data) => {
            const session = data.session;
            setSession(session);
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
            // Restore thread + artifacts
            restoreThreadState(session);
          })
          .catch((err) => {
            console.warn('[AiPage] Failed to restore session from URL:', err);
            // Fall through to create a local session below
            navigateToSession(); // clear invalid session from URL
          });
        return; // wait for the async load
      }
    }

    // No URL session and no active session → create a fresh local session
    if (!urlSessionId && !activeSession) {
      const localSession = createLocalSession();
      setActiveSessionAtom(localSession);
      setSelectedPages([]);
      clearMessages();
    }
  }, [urlSessionId, sessions, sessionsLoading]);

  // ── Sync URL when activeSession changes (e.g. after first message) ──
  useEffect(() => {
    if (activeSession?.id && !activeSession.id.startsWith('local-') && activeSession.id !== urlSessionId) {
      navigateToSession(activeSession.id);
    }
  }, [activeSession?.id]);

  // An "empty" session already exists if there's an active session with no messages yet.
  const isEmptySession = !!activeSession && messages.length === 0;

  /** Restore thread state (artifacts, design mode) from LangGraph for a session */
  const restoreThreadState = useCallback(
    (session: AiSession) => {
      const sessionThreadId = session.threadId || null;
      setThreadId(sessionThreadId);

      if (sessionThreadId) {
        setDesignMode(true);
        (async () => {
          try {
            const client = getLangGraphClient();
            const state = await client.threads.getState(sessionThreadId);
            const artifacts = (state?.values as any)?.artifacts;
            if (artifacts && Array.isArray(artifacts) && artifacts.length > 0) {
              console.log('[AiPage] Restored artifacts from thread:', artifacts);
              setPendingArtifacts(artifacts);
            }
          } catch (err) {
            console.warn('[AiPage] Failed to fetch thread state:', err);
          }
        })();
      }
    },
    [setThreadId, setDesignMode],
  );

  const handleNewChat = () => {
    // Don't create another session when the current one hasn't received any user input yet.
    if (isEmptySession) return;
    // Create a local session (will be persisted when user sends first message)
    const newSession = createLocalSession();
    setActiveSessionAtom(newSession);
    clearMessages();
    setSelectedPages([]);
    setThreadId(null);
    setHistoryOpen(false);
    restoredSessionRef.current = null;
    navigateToSession(); // clear session from URL
  };

  const handleSelectSession = (session: AiSession, skipNavigate = false) => {
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

    // Restore thread state (artifacts, design mode)
    restoreThreadState(session);

    if (!skipNavigate) {
      navigateToSession(session.id);
    }
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
        <ArtifactsRestorer artifacts={pendingArtifacts} onRestored={() => setPendingArtifacts(null)} />
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

// Bridge component: lives inside ArtifactsProvider to apply pending artifacts
function ArtifactsRestorer({
  artifacts,
  onRestored,
}: {
  artifacts: string[] | null;
  onRestored: () => void;
}) {
  const { setArtifacts, setOpen, setAutoOpen } = useArtifacts();

  useEffect(() => {
    if (artifacts && artifacts.length > 0) {
      setArtifacts(artifacts);
      setAutoOpen(true);
      setOpen(true);
      onRestored();
    }
  }, [artifacts, setArtifacts, setOpen, setAutoOpen, onRestored]);

  return null;
}
