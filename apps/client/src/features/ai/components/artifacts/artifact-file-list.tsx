import { useCallback, useState } from 'react';
import { Card, Text, Group, ActionIcon, Badge, Loader, Stack } from '@mantine/core';
import { IconDownload, IconCode, IconPackage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import {
  getFileExtensionDisplayName,
  getFileIcon,
  getFileName,
  urlOfArtifact,
  isSkillFile,
} from '../../lib/artifact-utils';
import { useArtifacts } from '../../context/artifacts-context';

import styles from './artifact-file-list.module.css';

interface ArtifactFileListProps {
  className?: string;
  files: string[];
  sessionId: string;
}

export function ArtifactFileList({ className, files, sessionId }: ArtifactFileListProps) {
  const { t } = useTranslation();
  const { select: selectArtifact, setOpen } = useArtifacts();

  const handleClick = useCallback(
    (filepath: string) => {
      selectArtifact(filepath);
      setOpen(true);
    },
    [selectArtifact, setOpen],
  );

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm" className={className}>
      {files.map((file) => (
        <ArtifactCard
          key={file}
          file={file}
          sessionId={sessionId}
          onClick={() => handleClick(file)}
        />
      ))}
    </Stack>
  );
}

interface ArtifactCardProps {
  file: string;
  sessionId: string;
  onClick: () => void;
}

function ArtifactCard({ file, sessionId, onClick }: ArtifactCardProps) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const isSkill = isSkillFile(file);

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = urlOfArtifact({ filepath: file, sessionId, download: true });
      window.open(url, '_blank');
    },
    [file, sessionId],
  );

  const handleInstallSkill = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (installing) return;

      setInstalling(true);
      try {
        // TODO: Implement install skill API call
        console.log('Installing skill:', file);
      } catch (error) {
        console.error('Failed to install skill:', error);
      } finally {
        setInstalling(false);
      }
    },
    [file, installing],
  );

  return (
    <Card
      className={styles.card}
      onClick={onClick}
      padding="sm"
    >
      <Group gap="sm" wrap="nowrap">
        <div className={styles.icon}>
          {getFileIcon(file, 'size-6')}
        </div>

        <div className={styles.info}>
          <Text size="sm" fw={500} lineClamp={1}>
            {getFileName(file)}
          </Text>
          <Badge size="xs" variant="light">
            {getFileExtensionDisplayName(file)}
          </Badge>
        </div>

        <Group gap={4} className={styles.actions}>
          {isSkill && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={handleInstallSkill}
              loading={installing}
              title={t('Install skill')}
            >
              {installing ? (
                <Loader size={14} />
              ) : (
                <IconPackage size={16} />
              )}
            </ActionIcon>
          )}
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleDownload}
            title={t('Download')}
          >
            <IconDownload size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Card>
  );
}
