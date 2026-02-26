import React, { useState } from 'react';
import {
  IconTool,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { ToolCall } from '../types/ai-chat.types';
import styles from './ToolCallBlock.module.css';

interface ToolCallBlockProps {
  toolCall: ToolCall;
  /** Result from the tool execution, if available */
  result?: string;
  status?: 'running' | 'success' | 'error';
}

export function ToolCallBlock({ toolCall, result, status = 'running' }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    running: <span className={styles.spinner} />,
    success: <IconCheck size={14} className={styles.successIcon} />,
    error: <IconX size={14} className={styles.errorIcon} />,
  }[status];

  const hasArgs = Object.keys(toolCall.args || {}).length > 0;

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <IconTool size={14} className={styles.toolIcon} />
        <span className={styles.toolName}>{toolCall.name}</span>
        {statusIcon}
        {(hasArgs || result) && (
          expanded
            ? <IconChevronDown size={12} className={styles.chevron} />
            : <IconChevronRight size={12} className={styles.chevron} />
        )}
      </button>

      {expanded && (
        <div className={styles.details}>
          {hasArgs && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Arguments</div>
              <pre className={styles.code}>
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Result</div>
              <pre className={styles.code}>{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
