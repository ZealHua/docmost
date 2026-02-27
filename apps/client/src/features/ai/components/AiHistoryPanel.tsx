import React, { useState, useMemo, useRef, useEffect } from "react";
import { IconX, IconTrash, IconPencil } from "@tabler/icons-react";
import { useClickOutside } from "@mantine/hooks";
import { AiSession } from "../types/ai-chat.types";
import { useTranslation } from "react-i18next";
import styles from "./AiHistoryPanel.module.css";

interface AiHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  sessions: AiSession[];
  activeSessionId?: string;
  onSelectSession: (session: AiSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => void;
}

type TimeCategory =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "thisQuarter"
  | "older";

interface GroupedSessions {
  [key: string]: AiSession[];
}

function getTimeCategory(date: Date): TimeCategory {
  const now = new Date();
  const sessionDate = new Date(date);

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(startOfToday);
  endOfYesterday.setMilliseconds(-1);

  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const startOfThisQuarter = new Date(
    now.getFullYear(),
    Math.floor(now.getMonth() / 3) * 3,
    1,
  );

  if (sessionDate >= startOfToday) return "today";
  if (sessionDate >= startOfYesterday && sessionDate <= endOfYesterday)
    return "yesterday";
  if (sessionDate >= startOfThisWeek) return "thisWeek";
  if (sessionDate >= startOfLastWeek) return "lastWeek";
  if (sessionDate >= startOfThisMonth) return "thisMonth";
  if (sessionDate >= startOfThisQuarter) return "thisQuarter";

  return "older";
}

function getCategoryLabel(
  category: TimeCategory,
  t: (key: string) => string,
): string {
  const labels: Record<TimeCategory, string> = {
    today: t("Today"),
    yesterday: t("Yesterday"),
    thisWeek: t("This Week"),
    lastWeek: t("Last Week"),
    thisMonth: t("This Month"),
    thisQuarter: t("This Quarter"),
    older: t("Older"),
  };
  return labels[category];
}

function groupSessionsByTime(sessions: AiSession[]): GroupedSessions {
  const groups: GroupedSessions = {};

  for (const session of sessions) {
    const category = getTimeCategory(new Date(session.updatedAt));
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(session);
  }

  return groups;
}

const categoryOrder: TimeCategory[] = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "thisQuarter",
  "older",
];

export function AiHistoryPanel({
  open,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: AiHistoryPanelProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const panelRef = useClickOutside(() => onClose());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((s) =>
      (s.title || "").toLowerCase().includes(query),
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    return groupSessionsByTime(filteredSessions);
  }, [filteredSessions]);

  const hasSessions = filteredSessions.length > 0;

  const handleSessionClick = (session: AiSession) => {
    if (editingId === session.id) return;
    onSelectSession(session);
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
  };

  const handleEditClick = (e: React.MouseEvent, session: AiSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title || "");
  };

  const handleRenameSubmit = () => {
    if (editingId && editTitle.trim() && onRenameSession) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditTitle("");
    }
  };

  return (
    <div
      ref={panelRef}
      className={`${styles.panel} ${open ? styles.panelOpen : styles.panelClosed}`}
    >
      {/* Panel header with Search */}
      <div className={styles.panelHeader}>
        <div className={styles.headerSearchWrapper}>
          <input
            type="text"
            placeholder={t("Search conversations...")}
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.panelActions}>
          <button className={styles.closeButton} onClick={onClose}>
            <IconX size={14} />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className={styles.sessionList}>
        {hasSessions ? (
          <>
            {categoryOrder.map((category) => {
              const categorySessions = groupedSessions[category];
              if (!categorySessions || categorySessions.length === 0)
                return null;

              return (
                <div key={category}>
                  <div className={styles.sectionLabel}>
                    {getCategoryLabel(category, t)}
                  </div>
                  {categorySessions.map((session) => (
                    <div
                      key={session.id}
                      className={`${styles.sessionItem} ${
                        activeSessionId === session.id ? styles.active : ""
                      }`}
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className={styles.sessionInfo}>
                        {editingId === session.id ? (
                          <input
                            ref={inputRef}
                            type="text"
                            className={styles.renameInput}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={handleRenameKeyDown}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={styles.sessionTitle}>
                            {session.title || t("New chat")}
                          </span>
                        )}
                      </div>
                      <div className={styles.sessionActions}>
                        {onRenameSession && !editingId && (
                          <button
                            className={styles.editButton}
                            onClick={(e) => handleEditClick(e, session)}
                            aria-label={t("Rename session")}
                          >
                            <IconPencil size={14} />
                          </button>
                        )}
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => handleDeleteClick(e, session.id)}
                          aria-label={t("Delete session")}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ) : (
          <div className={styles.emptySessions}>
            <div className={styles.emptySessionsText}>
              {searchQuery ? t("No conversations found") : t("No chats yet")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
