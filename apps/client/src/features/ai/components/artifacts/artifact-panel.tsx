import { Box, ActionIcon, Text, Tooltip } from '@mantine/core';
import { Panel, Group as PanelGroup, Separator, type PanelImperativeHandle } from 'react-resizable-panels';
import { IconX, IconFiles } from '@tabler/icons-react';
import { ReactNode, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useArtifacts } from '../../context/artifacts-context';
import { ArtifactFileList } from './artifact-file-list';
import { ArtifactFileDetail } from './artifact-file-detail';

import styles from './artifact-panel.module.css';

interface ArtifactPanelProps {
  sessionId: string;
  children: ReactNode;
}

export function ArtifactPanel({ sessionId, children }: ArtifactPanelProps) {
  const { t } = useTranslation();
  const { artifactPanelOpen, open, artifacts, selectedArtifact, setOpen } =
    useArtifacts();

  const handleStyle = useMemo(() => {
    return open ? styles.handle : `${styles.handle} ${styles.handleHidden}`;
  }, [open]);

  const artifactPanelClass = useMemo(() => {
    return artifactPanelOpen
      ? styles.artifactPanel
      : `${styles.artifactPanel} ${styles.artifactPanelHidden}`;
  }, [artifactPanelOpen]);

  const panelRef = useRef<PanelImperativeHandle>(null);

  useEffect(() => {
    if (artifactPanelOpen) {
      if (panelRef.current?.isCollapsed()) {
        panelRef.current?.resize("54");
      }
    } else {
      panelRef.current?.collapse();
    }
  }, [artifactPanelOpen]);

  return (
    <PanelGroup orientation="horizontal" className={styles.panelGroup}>
      <Panel
        defaultSize={artifactPanelOpen ? "46" : "100"}
        minSize="10"
        className={styles.chatPanel}
      >
        {children}
      </Panel>

      <Separator 
        className={handleStyle} 
        id="artifact-handle" 
        disabled={!artifactPanelOpen} 
      />

      <Panel
        panelRef={panelRef}
        collapsible={true}
        collapsedSize="0"
        defaultSize={artifactPanelOpen ? "54" : "0"}
        maxSize="90"
        minSize="10"
        className={artifactPanelClass}
      >
        <Box className={styles.artifactContent}>
          {/* Close button — always visible at top-right */}
          <div className={styles.closeButton}>
            <Tooltip label={t('Close')}>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </div>

          {selectedArtifact ? (
            <ArtifactFileDetail sessionId={sessionId} />
          ) : artifacts.length === 0 ? (
            /* Empty state */
            <Box className={styles.emptyState}>
              <IconFiles size={48} stroke={1.2} opacity={0.4} />
              <Text size="sm" c="dimmed" mt="sm">
                {t('No artifacts yet')}
              </Text>
            </Box>
          ) : (
            /* File list */
            <Box className={styles.listContainer}>
              <Box className={styles.listHeader}>
                <Text size="lg" fw={500}>
                  {t('Artifacts')}
                </Text>
              </Box>
              <Box className={styles.listBody}>
                <ArtifactFileList files={artifacts} sessionId={sessionId} />
              </Box>
            </Box>
          )}
        </Box>
      </Panel>
    </PanelGroup>
  );
}
