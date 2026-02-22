import React from 'react';
import { useAtomValue } from 'jotai';
import { Tooltip } from '@mantine/core';
import { aiMemoriesAtom, aiMemoryErrorAtom } from '../store/ai.atoms';
import styles from './AiMemoryStatus.module.css';

interface AiMemoryStatusProps {
  className?: string;
}

export function AiMemoryStatus({ className }: AiMemoryStatusProps) {
  const memories = useAtomValue(aiMemoriesAtom);
  const memoryError = useAtomValue(aiMemoryErrorAtom);

  if (memoryError) {
    return (
      <Tooltip label={`Memory error: ${memoryError}`}>
        <span className={`${styles.dot} ${styles.error} ${className}`} />
      </Tooltip>
    );
  }

  if (memories.length === 0) {
    return null;
  }

  return (
    <Tooltip label={`${memories.length} memory${memories.length !== 1 ? 'ies' : ''} loaded`}>
      <span className={`${styles.dot} ${styles.loaded} ${className}`}>
        <span className={styles.count}>{memories.length}</span>
      </span>
    </Tooltip>
  );
}
