import { Box } from '@mantine/core';
import { Panel, Group as PanelGroup, Separator } from 'react-resizable-panels';
import { ReactNode, useMemo } from 'react';

import { useArtifacts } from '../../context/artifacts-context';
import { ArtifactFileList } from './artifact-file-list';
import { ArtifactFileDetail } from './artifact-file-detail';

import styles from './artifact-panel.module.css';

interface ArtifactPanelProps {
  sessionId: string;
  children: ReactNode;
}

export function ArtifactPanel({ sessionId, children }: ArtifactPanelProps) {
  const { artifactPanelOpen, open, artifacts } = useArtifacts();

  const handleStyle = useMemo(() => {
    return open ? styles.handle : `${styles.handle} ${styles.handleHidden}`;
  }, [open]);

  return (
    <PanelGroup orientation="horizontal" className={styles.panelGroup}>
      <Panel
        defaultSize={artifactPanelOpen ? 46 : 100}
        minSize={30}
        className={styles.chatPanel}
      >
        {children}
      </Panel>

      {artifactPanelOpen && (
        <Separator className={handleStyle} id="artifact-handle" />
      )}

      <Panel
        defaultSize={artifactPanelOpen ? 54 : 0}
        maxSize={artifactPanelOpen ? 80 : 0}
        minSize={20}
        className={styles.artifactPanel}
      >
        <Box className={styles.artifactContent}>
          <ArtifactFileList files={artifacts} sessionId={sessionId} />
          <ArtifactFileDetail sessionId={sessionId} />
        </Box>
      </Panel>
    </PanelGroup>
  );
}
