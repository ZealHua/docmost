import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Group,
  ActionIcon,
  Text,
  ScrollArea,
  Tooltip,
  Loader,
  Select,
  SegmentedControl,
} from '@mantine/core';
import {
  IconX,
  IconCopy,
  IconCheck,
  IconDownload,
  IconExternalLink,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

import {
  checkCodeFile,
  getFileName,
  isWriteFileArtifact,
  isSkillFile,
  isPreviewable,
  urlOfArtifact,
} from '../../lib/artifact-utils';
import { useArtifacts } from '../../context/artifacts-context';
import { useArtifactContent } from '../../hooks/use-artifact-content';

import styles from './artifact-file-detail.module.css';

interface ArtifactFileDetailProps {
  sessionId: string;
}

export function ArtifactFileDetail({ sessionId }: ArtifactFileDetailProps) {
  const { t } = useTranslation();
  const { selectedArtifact, deselect, artifacts, select } = useArtifacts();
  const [copied, setCopied] = useState(false);

  const filepath = selectedArtifact;

  const isWriteFile = useMemo(() => {
    return filepath ? isWriteFileArtifact(filepath) : false;
  }, [filepath]);

  const actualPath = useMemo(() => {
    if (!filepath) return null;
    return isWriteFile ? filepath.replace(/^write-file:/, '') : filepath;
  }, [filepath, isWriteFile]);

  const isSkill = useMemo(() => {
    return filepath ? isSkillFile(filepath) : false;
  }, [filepath]);

  const { isCodeFile, language } = useMemo(() => {
    if (!filepath) return { isCodeFile: false, language: 'text' };

    if (isWriteFile) {
      let lang = checkCodeFile(actualPath || '').language;
      lang ||= 'text';
      return { isCodeFile: true, language: lang };
    }

    if (isSkill) {
      return { isCodeFile: true, language: 'markdown' };
    }

    return checkCodeFile(filepath);
  }, [filepath, isWriteFile, isSkill, actualPath]);

  const previewable = useMemo(() => {
    if (!filepath) return false;
    return isPreviewable(filepath) && !isWriteFile;
  }, [filepath, isWriteFile]);

  // View mode: user-toggleable for previewable files
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('preview');

  // Reset view mode when file changes
  useMemo(() => {
    setViewMode(previewable ? 'preview' : 'code');
  }, [filepath, previewable]);

  const artifactUrl = useMemo(() => {
    if (!actualPath || !sessionId) return '';
    return urlOfArtifact({ filepath: actualPath, sessionId });
  }, [actualPath, sessionId]);

  // Fetch content via React Query
  const {
    content,
    isLoading: loading,
    error,
  } = useArtifactContent({
    filepath: actualPath || '',
    sessionId,
    enabled: !!actualPath && viewMode === 'code',
  });

  const handleCopy = useCallback(async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleOpenInNewTab = useCallback(() => {
    if (artifactUrl) {
      window.open(artifactUrl, '_blank');
    }
  }, [artifactUrl]);

  const handleDownload = useCallback(() => {
    if (actualPath && sessionId) {
      const url = urlOfArtifact({ filepath: actualPath, sessionId, download: true });
      window.open(url, '_blank');
    }
  }, [actualPath, sessionId]);

  // File selector data for the dropdown
  const selectorData = useMemo(() => {
    return artifacts.map((f) => ({
      value: f,
      label: getFileName(f),
    }));
  }, [artifacts]);

  if (!filepath || !actualPath) {
    return (
      <Box className={styles.container}>
        <Box className={styles.empty}>
          <Text size="sm" c="dimmed">
            {t('Select a file to preview')}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      <Box className={styles.header}>
        <Group gap="xs" className={styles.headerLeft}>
          {/* File selector dropdown */}
          {artifacts.length > 1 ? (
            <Select
              data={selectorData}
              value={filepath}
              onChange={(val) => val && select(val)}
              size="xs"
              w={180}
              comboboxProps={{ withinPortal: false }}
              styles={{
                input: { fontWeight: 500 },
              }}
            />
          ) : (
            <Text size="sm" fw={500} lineClamp={1}>
              {getFileName(actualPath)}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {language}
          </Text>
        </Group>

        <Group gap={4} className={styles.headerRight}>
          {/* Code / Preview toggle for previewable files */}
          {previewable && (
            <SegmentedControl
              size="xs"
              data={[
                { label: t('Preview'), value: 'preview' },
                { label: t('Code'), value: 'code' },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'code' | 'preview')}
            />
          )}

          <Tooltip label={t('Open in new tab')}>
            <ActionIcon variant="subtle" size="sm" onClick={handleOpenInNewTab}>
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>

          {viewMode === 'code' && (
            <Tooltip label={copied ? t('Copied!') : t('Copy')}>
              <ActionIcon variant="subtle" size="sm" onClick={handleCopy}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label={t('Download')}>
            <ActionIcon variant="subtle" size="sm" onClick={handleDownload}>
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('Close')}>
            <ActionIcon variant="subtle" size="sm" onClick={deselect}>
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <ScrollArea className={styles.content}>
        {loading && (
          <Box className={styles.loading}>
            <Loader size="sm" />
          </Box>
        )}

        {error && (
          <Box className={styles.loading}>
            <Text size="sm" c="red">
              {t('Failed to load artifact')}
            </Text>
          </Box>
        )}

        {!loading && !error && viewMode === 'code' && (
          <CodeViewer content={content} language={language} />
        )}

        {!loading && !error && viewMode === 'preview' && (
          <PreviewViewer url={artifactUrl} language={language} />
        )}
      </ScrollArea>
    </Box>
  );
}

interface CodeViewerProps {
  content: string;
  language: string;
}

function CodeViewer({ content, language }: CodeViewerProps) {
  const isMarkdown = language === 'markdown';

  if (isMarkdown) {
    return (
      <Box className={styles.markdownWrapper}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </Box>
    );
  }

  return (
    <Box className={styles.codeWrapper}>
      <pre className={styles.pre}>
        <code className={styles.code}>{content}</code>
      </pre>
    </Box>
  );
}

interface PreviewViewerProps {
  url: string;
  language: string;
}

function PreviewViewer({ url, language }: PreviewViewerProps) {
  const isMarkdown = language === 'markdown';

  if (isMarkdown) {
    return (
      <Box className={styles.markdownWrapper}>
        <iframe
          src={url}
          className={styles.iframe}
          sandbox="allow-same-origin"
          title="Preview"
        />
      </Box>
    );
  }

  return (
    <Box className={styles.previewWrapper}>
      <iframe
        src={url}
        className={styles.iframe}
        sandbox="allow-scripts allow-same-origin"
        title="Preview"
      />
    </Box>
  );
}
