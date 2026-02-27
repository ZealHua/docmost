import { useEffect, useRef, useState } from "react";
import { Collapse } from "@mantine/core";
import { IconBrain, IconChevronDown, IconSparkles } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import styles from "./ThinkingBlock.module.css";

interface ThinkingBlockProps {
  thinking: string;
  isStreaming: boolean;
  defaultOpen?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ThinkingBlock({
  thinking = "",
  isStreaming = false,
  defaultOpen = false,
}: ThinkingBlockProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen || isStreaming);
  const [duration, setDuration] = useState<number | null>(null);
  const startRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming) {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (elapsed > 0) {
        setDuration(elapsed);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming && open && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isStreaming, open]);

  if (!thinking) return null;

  const sublabel = isStreaming
    ? t("Reasoning...", { time: formatDuration(elapsed) })
    : duration
      ? t("Reasoned for {{time}}", { time: formatDuration(duration) })
      : t("Reasoning complete");

  const wrapperClass = `${styles.wrapper} ${isStreaming ? styles.wrapperActive : ""}`;

  return (
    <div className={wrapperClass}>
      <span className={`${styles.corner} ${styles.cornerTopLeft}`} />
      <span className={`${styles.corner} ${styles.cornerTopRight}`} />
      <span className={`${styles.corner} ${styles.cornerBottomLeft}`} />
      <span className={`${styles.corner} ${styles.cornerBottomRight}`} />

      {isStreaming && <div className={styles.scanLine} />}

      <div className={styles.header} onClick={() => setOpen((o) => !o)}>
        <div className={styles.iconRing}>
          <IconBrain size={13} strokeWidth={1.8} />
        </div>

        <div className={styles.labelGroup}>
          <span
            className={`${styles.label} ${!isStreaming ? styles.labelStatic : ""}`}
          >
            {t("Thinking")}
          </span>
          <span className={styles.sublabel}>{sublabel}</span>
        </div>

        {isStreaming ? (
          <div className={styles.dots}>
            <div className={styles.dot} />
            <div className={styles.dot} />
            <div className={styles.dot} />
          </div>
        ) : (
          <div className={styles.doneBadge}>
            <IconSparkles size={10} strokeWidth={2} />
            {t("Done")}
          </div>
        )}

        <IconChevronDown
          size={14}
          strokeWidth={2}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </div>

      <Collapse
        in={open}
        transitionDuration={300}
        transitionTimingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <div className={styles.divider} />
        <div className={styles.content}>
          <div ref={contentRef} className={styles.text}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thinking}
            </ReactMarkdown>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
