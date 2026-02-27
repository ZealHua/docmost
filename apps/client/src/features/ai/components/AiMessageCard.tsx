import React, { ReactNode } from "react";
import styles from "./AiMessageCard.module.css";

interface AiMessageCardProps {
  header?: ReactNode;
  children: ReactNode;
  citations?: ReactNode;
  footer?: ReactNode;
}

export function AiMessageCard({
  header,
  children,
  citations,
  footer,
}: AiMessageCardProps) {
  return (
    <div className={styles.card}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {citations && <div className={styles.citations}>{citations}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
