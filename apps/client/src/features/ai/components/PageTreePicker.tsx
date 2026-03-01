import { useCallback, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { Modal, Box, Text, Checkbox, Stack, Button, Loader, ActionIcon, Group } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconX } from '@tabler/icons-react';
import { Tree, NodeRendererProps, NodeApi } from 'react-arborist';
import api from '@/lib/api-client';
import { PageTreeItem } from '../utils/page-tree-utils';
import { getAllDescendants, getAncestorIds } from '../utils/page-tree-utils';
import { usePageTreeSelection } from '../hooks/use-page-tree-selection';
import { aiSelectedPagesAtom } from '../store/ai.atoms';
import { AiPageSearchResult } from '../hooks/use-ai-page-search';
import classes from './PageTreePicker.module.css';

interface PageTreePickerProps {
  spaceId: string;
  spaceSlug: string;
  opened: boolean;
  onClose: () => void;
}

/**
 * PageTreePicker component for selecting pages in a hierarchical tree.
 *
 * Features:
 * - Virtualized rendering with react-arborist
 * - Auto-select children when parent is selected
 * - Remove ancestors when child is deselected
 * - Indeterminate checkboxes for partial selections
 * - O(1) state lookup for performance
 */
export function PageTreePicker({
  spaceId,
  spaceSlug,
  opened,
  onClose,
}: PageTreePickerProps) {
  const [selectedPages, setSelectedPages] = useAtom(aiSelectedPagesAtom);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Tree container ref and height for dynamic sizing
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(500);

  // ResizeObserver to track container height
  useEffect(() => {
    if (!treeContainerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setTreeHeight(entry.contentRect.height);
    });
    observer.observe(treeContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch page tree
  const { data: treeData, isLoading, error } = useQuery({
    queryKey: ['ai-page-tree', spaceId],
    queryFn: async () => {
      const response = await api.get<PageTreeItem[]>(`/ai/pages/tree?spaceId=${spaceId}`);
      return response.data;
    },
    enabled: opened && !!spaceId,
  });

  // Compute selection state map (O(1) lookup)
  const selectionState = usePageTreeSelection(treeData || []);

  // Handle page selection/deselection
  const handleSelectPage = useCallback(
    (node: NodeApi<PageTreeItem>, isSelected: boolean) => {
      // Use raw data from node for mapping
      const rawData = node.data;
      const descendants = getAllDescendants(rawData);
      const targetNodes = [rawData, ...descendants];

      if (isSelected) {
        // SELECT: Map to full format to prevent blank badges
        setSelectedPages((prev) => {
          const existingIds = new Set(prev.map((p) => p.pageId));

          const newPages = targetNodes
            .filter((n) => !existingIds.has(n.id))
            .map((n) => ({
              pageId: n.id,
              title: n.title || '',
              slugId: n.slugId,
              spaceId: n.spaceId,
              spaceSlug: spaceSlug,
            }));

          return [...prev, ...newPages];
        });
      } else {
        // DESELECT: Remove target node, descendants, AND ancestors
        setSelectedPages((prev) => {
          const idsToRemove = new Set(targetNodes.map((n) => n.id));

          // This prevents stuck parent checkboxes!
          const ancestorIds = getAncestorIds(node);
          ancestorIds.forEach((id) => idsToRemove.add(id));

          return prev.filter((p) => !idsToRemove.has(p.pageId));
        });
      }
    },
    [spaceSlug, setSelectedPages],
  );

  // Node renderer for react-arborist
  const NodeRenderer = ({ node, style }: NodeRendererProps<PageTreeItem>) => {
    // O(1) lookup during rapid scrolling!
    const state = selectionState.get(node.id) || { selected: false, indeterminate: false };

    return (
      <div style={style} className="tree-node">
        <Group gap={6} wrap="nowrap">
          {/* Expand/Collapse Button */}
          {node.data.children.length > 0 ? (
            <ActionIcon
              size={20}
              variant="subtle"
              color="gray"
              onClick={() => node.toggle()}
            >
              {node.isOpen ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </ActionIcon>
          ) : (
            <Box w={20} />
          )}

          {/* Spacer for alignment */}
          {/* Checkbox */}
          <Checkbox
            checked={state.selected}
            indeterminate={state.indeterminate}
            onChange={(e) => handleSelectPage(node, e.currentTarget.checked)}
            styles={{
              input: {
                cursor: 'pointer',
              },
              label: {
                cursor: 'pointer',
              },
            }}
          />

          {/* Icon */}
          {node.data.icon && <Text size="sm">{node.data.icon}</Text>}

          {/* Title */}
          <Text size="sm" truncate>
            {node.data.title || 'Untitled'}
          </Text>
        </Group>
      </div>
    );
  };

  const handleClearAll = useCallback(() => {
    setSelectedPages([]);
  }, [setSelectedPages]);

  const selectedCount = selectedPages.length;

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      size="md"
      yOffset="10vh"
      xOffset={0}
      padding="lg"
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: 'hidden' }}>
        <Modal.Header>
          <Modal.Title>Select Pages for Context</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
          {isLoading && (
            <Box p="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader size="md" />
            </Box>
          )}

          {error && (
            <Box p="xl">
              <Text c="red">Failed to load pages: {(error as Error).message}</Text>
            </Box>
          )}

          {treeData && treeData.length === 0 && (
            <Box p="xl">
              <Text c="dimmed">No pages found in this space.</Text>
            </Box>
          )}

          {treeData && treeData.length > 0 && (
            <>
              {/* Selection Summary */}
              <Box pb="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {selectedCount === 0
                      ? 'No pages selected'
                      : `${selectedCount} page${selectedCount !== 1 ? 's' : ''} selected`}
                  </Text>
                  {selectedCount > 0 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={handleClearAll}
                    >
                      Clear All
                    </Button>
                  )}
                </Group>
              </Box>

              {/* Tree */}
              <Box
                ref={treeContainerRef}
                flex={1}
                className={classes.treeContainer}
                style={{ overflow: 'hidden' }}
              >
                <Tree
                  data={treeData}
                  openByDefault={false}
                  height={treeHeight}
                  indent={20}
                  rowHeight={40}
                  overscanCount={10}
                >
                  {NodeRenderer}
                </Tree>
              </Box>

              {/* Footer */}
              <Box pt="md">
                <Group justify="flex-end">
                  <Button variant="default" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={onClose}>Done</Button>
                </Group>
              </Box>
            </>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}