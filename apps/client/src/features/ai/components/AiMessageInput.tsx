import React, { useCallback, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Select,
  Switch,
  Popover,
  TextInput,
  List,
  Badge,
  Button,
  Group,
  Alert,
} from "@mantine/core";
import {
  IconPlayerStop,
  IconSend,
  IconPlus,
  IconSearch,
  IconAdjustments,
  IconX,
  IconSparkles,
  IconFolderOpen,
} from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import {
  aiIsStreamingAtom,
  aiSelectedModelAtom,
  aiThinkingAtom,
  aiSelectedPagesAtom,
  aiWebSearchEnabledAtom,
} from "../store/ai.atoms";
import { useAiChat } from "../hooks/use-ai-chat";
import {
  useAiPageSearch,
  AiPageSearchResult,
} from "../hooks/use-ai-page-search";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import { useParams } from "react-router-dom";
import { MODEL_CONFIG } from "../lib/models.config";
import { useTranslation } from "react-i18next";
import styles from "./AiMessageInput.module.css";
import { PageTreePicker } from "./PageTreePicker";
import { useDeepResearch } from "../hooks/use-deep-research";
import { ClarificationModal } from "./ClarificationModal";
import { PlanApprovalDialog } from "./PlanApprovalDialog";
import { userAtom } from "@/features/user/atoms/current-user-atom";

interface AiMessageInputProps {
  workspaceId?: string;
}

export function AiMessageInput({ workspaceId }: AiMessageInputProps) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useSpaceQuery(spaceSlug || "");
  const spaceId = space?.id;

  const isStreaming = useAtomValue(aiIsStreamingAtom);
  const [selectedModel, setSelectedModel] = useAtom(aiSelectedModelAtom);
  const [thinking, setThinking] = useAtom(aiThinkingAtom);
  const [webSearchEnabled, setWebSearchEnabled] = useAtom(
    aiWebSearchEnabledAtom,
  );
  const [selectedPages, setSelectedPages] = useAtom(aiSelectedPagesAtom);

  const { sendMessage, stopStream } = useAiChat(workspaceId);
  const user = useAtomValue(userAtom);
  const deepResearch = useDeepResearch(workspaceId, user?.id || '');
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [treePickerOpen, setTreePickerOpen] = useState(false);

  const pageSearch = useAiPageSearch();

  const currentModelConfig = MODEL_CONFIG[selectedModel];
  const supportsThinking = currentModelConfig?.supportsThinking ?? false;

  const handleSearchPages = useCallback(
    async (query: string) => {
      if (!spaceId) return;
      await pageSearch.mutateAsync({ query, spaceId });
    },
    [spaceId, pageSearch],
  );

  const handleAddPage = useCallback(
    (page: AiPageSearchResult) => {
      setSelectedPages((prev) => {
        if (prev.some((p) => p.pageId === page.pageId)) return prev;
        return [...prev, page];
      });
      setPickerOpen(false);
      setSearchQuery("");
    },
    [setSelectedPages],
  );

  const handleRemovePage = useCallback(
    (pageId: string) => {
      setSelectedPages((prev) => prev.filter((p) => p.pageId !== pageId));
    },
    [setSelectedPages],
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;

    if (deepResearchEnabled) {
      deepResearch.startResearch(trimmed, {
        model: selectedModel,
        isWebSearchEnabled: webSearchEnabled,
        selectedPageIds: selectedPages.map(p => p.pageId),
      });
    } else {
      sendMessage(trimmed);
    }
    setValue("");
  }, [
    value,
    isStreaming,
    deepResearchEnabled,
    deepResearch.startResearch,
    selectedModel,
    webSearchEnabled,
    selectedPages,
    sendMessage,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
    },
    [],
  );

  const hasInput = value.trim().length > 0;

  const modelOptions = Object.entries(MODEL_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
  }));

  const isDeepResearchActive = !deepResearch.state.matches('idle') && !deepResearch.state.matches('completed') && !deepResearch.state.matches('error');

  const handleStop = useCallback(() => {
    if (isDeepResearchActive) {
      deepResearch.cancelResearch();
      return;
    }
    stopStream();
  }, [deepResearch.cancelResearch, isDeepResearchActive, stopStream]);

  return (
    <Box className={styles.inputWrapper}>
      <Box className={styles.inputPill}>
        <div className={styles.scanLine} />
        <span className={`${styles.corner} ${styles.cornerTopLeft}`} />
        <span className={`${styles.corner} ${styles.cornerTopRight}`} />
        <span className={`${styles.corner} ${styles.cornerBottomLeft}`} />
        <span className={`${styles.corner} ${styles.cornerBottomRight}`} />

        {/* Line 1: Textarea */}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={t("What are your thoughts?")}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
        />

        {/* Selected Pages Tags */}
        {selectedPages.length > 0 && (
          <Group gap={6} mt={8} ml={1}>
            {selectedPages.map((page) => (
              <Badge
                key={page.pageId}
                size="sm"
                variant="light"
                color="blue"
                rightSection={
                  <Box
                    component="span"
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={() => handleRemovePage(page.pageId)}
                  >
                    <IconX size={12} />
                  </Box>
                }
                styles={{ root: { cursor: "default" } }}
              >
                {page.title}
              </Badge>
            ))}
          </Group>
        )}

        {/* Line 2: Toolbar inside pill */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {/* Tree Picker Button */}
            {spaceId && (
              <button
                className={styles.iconButton}
                onClick={() => setTreePickerOpen(true)}
                title={t("Select pages from tree")}
              >
                <IconFolderOpen size={16} />
              </button>
            )}

            <Popover
              position="top"
              withArrow
              shadow="md"
              opened={pickerOpen}
              onChange={setPickerOpen}
            >
              <Popover.Target>
                <button
                  className={styles.iconButton}
                  onClick={() => setPickerOpen(true)}
                >
                  <IconPlus size={16} />
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <Box w={280}>
                  <TextInput
                    placeholder={t("Search pages")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearchPages(e.target.value);
                    }}
                    size="xs"
                    mb="xs"
                  />
                  {pageSearch.isPending && (
                    <Box ta="center" py="xs">
                      {t("Searching...")}
                    </Box>
                  )}
                  {pageSearch.data && pageSearch.data.length > 0 && (
                    <List
                      size="xs"
                      style={{ maxHeight: 200, overflow: "auto" }}
                    >
                      {pageSearch.data.map((page) => (
                        <List.Item key={page.pageId}>
                          <Button
                            variant="subtle"
                            size="xs"
                            fullWidth
                            onClick={() => handleAddPage(page)}
                            disabled={selectedPages.some(
                              (p) => p.pageId === page.pageId,
                            )}
                          >
                            {page.title}
                          </Button>
                        </List.Item>
                      ))}
                    </List>
                  )}
                  {pageSearch.data &&
                    pageSearch.data.length === 0 &&
                    searchQuery && (
                      <Box ta="center" c="dimmed" py="xs">
                        {t("No pages found")}
                      </Box>
                    )}
                </Box>
              </Popover.Dropdown>
            </Popover>
          </div>

          <div className={styles.toolbarRight}>
            <Popover position="top" withArrow shadow="md">
              <Popover.Target>
                <button className={styles.iconButton}>
                  <IconAdjustments size={16} />
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className={styles.settingsDropdown}>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>{t("Model")}</span>
                    <Select
                      className={styles.modelSelect}
                      data={modelOptions}
                      value={selectedModel}
                      onChange={(val) =>
                        setSelectedModel(val || "glm-4.7-flash")
                      }
                      size="xs"
                      radius="sm"
                      comboboxProps={{ withinPortal: true }}
                      allowDeselect={false}
                    />
                  </div>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>
                      {t("Thinking")}
                    </span>
                    <Switch
                      size="xs"
                      checked={thinking}
                      onChange={(e) => setThinking(e.currentTarget.checked)}
                      aria-label={t("Extended thinking")}
                      disabled={!supportsThinking}
                    />
                  </div>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>
                      {t("Web Search")}
                    </span>
                    <Switch
                      size="xs"
                      checked={webSearchEnabled}
                      onChange={(e) =>
                        setWebSearchEnabled(e.currentTarget.checked)
                      }
                      aria-label={t("Enable Web Search")}
                    />
                  </div>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>
                      {t("Deep Research")}
                    </span>
                    <Switch
                      size="xs"
                      checked={deepResearchEnabled}
                      onChange={(e) =>
                        setDeepResearchEnabled(e.currentTarget.checked)
                      }
                      aria-label={t("Enable Deep Research")}
                      disabled={!webSearchEnabled}
                    />
                  </div>
                </div>
              </Popover.Dropdown>
            </Popover>

            {isStreaming ? (
              <ActionIcon
                className={`${styles.sendButton} ${styles.stop}`}
                onClick={handleStop}
                aria-label={t("Stop generating")}
                size="lg"
                radius="xl"
              >
                <IconPlayerStop size={16} />
              </ActionIcon>
            ) : (
              <ActionIcon
                className={`${styles.sendButton} ${hasInput ? styles.enabled : styles.disabled}`}
                onClick={handleSend}
                disabled={!hasInput}
                aria-label={t("Send message")}
                size="lg"
                radius="xl"
              >
                <IconSend size={16} />
              </ActionIcon>
            )}
          </div>
        </div>
      </Box>

      {/* Page Tree Picker Modal */}
      {spaceId && spaceSlug && (
        <PageTreePicker
          spaceId={spaceId}
          spaceSlug={spaceSlug}
          opened={treePickerOpen}
          onClose={() => setTreePickerOpen(false)}
        />
      )}

      {/* Deep Research UI Components */}
      <ClarificationModal
        opened={deepResearch.state.matches('awaitingClarification')}
        onClose={() => deepResearch.cancelResearch()}
        onSubmit={(answer) => deepResearch.provideClarification(answer)}
        question={deepResearch.state.context.clarificationQuestion}
        round={deepResearch.state.context.clarificationRound}
      />

      <PlanApprovalDialog
        opened={deepResearch.state.matches('awaitingPlanApproval')}
        onClose={() => undefined}
        plan={deepResearch.state.context.researchPlan}
        onApprove={() => deepResearch.approvePlan()}
        onReject={() => deepResearch.rejectPlan()}
      />

      {deepResearch.state.matches('error') && deepResearch.state.context.error ? (
        <Box mt="md">
          <Alert color="red" title={t("Deep Research Error")}>
            {deepResearch.state.context.error}
          </Alert>
        </Box>
      ) : null}
    </Box>
  );
}
