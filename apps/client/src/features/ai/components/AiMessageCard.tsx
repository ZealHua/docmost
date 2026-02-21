import React, { ReactNode } from "react";
import styles from "./AiMessageCard.module.css";

interface AiMessageCardProps {
  header?: ReactNode;
  children: ReactNode;
  citations?: ReactNode;
}

export function AiMessageCard({
  header,
  children,
  citations,
}: AiMessageCardProps) {
  return (
    <div className={styles.card}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {citations && <div className={styles.citations}>{citations}</div>}
    </div>
  );
}
