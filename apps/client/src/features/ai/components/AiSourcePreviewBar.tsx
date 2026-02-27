import React, { KeyboardEvent } from "react";
import { IconWorld } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { RagSource } from "../types/ai-chat.types";
import {
  aiActiveSourceMessageIdAtom,
  aiSourceSidebarOpenAtom,
} from "../store/ai.atoms";
import styles from "./AiSourcePreviewBar.module.css";

interface AiSourcePreviewBarProps {
  messageId: string;
  sources: RagSource[];
}

const getFavicon = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "/default-favicon.ico";
  }
};

export function AiSourcePreviewBar({
  messageId,
  sources,
}: AiSourcePreviewBarProps) {
  const { t } = useTranslation();
  const [, setActiveMessageId] = useAtom(aiActiveSourceMessageIdAtom) as [
    unknown,
    (id: string) => void,
  ];
  const [, setSidebarOpen] = useAtom(aiSourceSidebarOpenAtom) as [
    unknown,
    (open: boolean) => void,
  ];

  const webSources = sources.filter((s) => s.url);

  if (webSources.length === 0) {
    return null;
  }

  const handleOpenSidebar = () => {
    setActiveMessageId(messageId);
    setSidebarOpen(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpenSidebar();
    }
  };

  const previewSources = webSources.slice(0, 4);
  const remainingCount = webSources.length - 4;

  return (
    <div
      className={styles.container}
      onClick={handleOpenSidebar}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={t("View {{count}} sources", { count: webSources.length })}
    >
      <div className={styles.labelGroup}>
        <IconWorld size={14} className={styles.icon} />
        <span className={styles.labelText}>
          {webSources.length}{" "}
          {webSources.length === 1 ? t("source") : t("sources")}
        </span>
      </div>

      <div className={styles.faviconGroup}>
        {previewSources.map((source, idx) => (
          <img
            key={`${source.url}-${idx}`}
            src={getFavicon(source.url!)}
            alt=""
            className={styles.favicon}
            onError={(e) => {
              e.currentTarget.src =
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCI+PC9jaXJjbGU+PGxpbmUgeDE9IjIiIHkxPSIxMiIgeDI9IjIyIiB5Mj0iMTIiPjwvbGluZT48cGF0aCBkPSJNMTIgMmExNS4zIDE1LjMgMCAwIDEgN DEwIDE1LjMgMTUuMyAwIDAgMS00IDEwIDE1LjMgMTUuMyAwIDAgMS00LTEwIDE1LjMgMTUuMyAwIDAgMSA0LTEweiI+PC9wYXRoPjwvc3ZnPg==";
            }}
          />
        ))}
        {remainingCount > 0 && (
          <div className={styles.remainingBadge}>+{remainingCount}</div>
        )}
      </div>
    </div>
  );
}
