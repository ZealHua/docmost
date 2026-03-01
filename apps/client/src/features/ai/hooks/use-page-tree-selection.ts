import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { aiSelectedPagesAtom } from '../store/ai.atoms';
import { PageTreeItem } from '../utils/page-tree-utils';
import { getAllDescendants } from '../utils/page-tree-utils';

/**
 * Selection state for a single tree node.
 */
export interface NodeSelectionState {
  selected: boolean;
  indeterminate: boolean;
}

/**
 * Hook that computes selection state for all tree nodes.
 * Returns a Map for O(1) lookup during rendering.
 *
 * This is computed once when treeData or selectedPages change,
 * ensuring fast O(1) lookups during rapid virtualized scrolling.
 */
export function usePageTreeSelection(treeData: PageTreeItem[]): Map<string, NodeSelectionState> {
  const selectedPages = useAtomValue(aiSelectedPagesAtom);

  return useMemo(() => {
    const state = new Map<string, NodeSelectionState>();

    const processNode = (node: PageTreeItem) => {
      const isSelected = selectedPages.some((p) => p.pageId === node.id);
      const descendants = getAllDescendants(node);
      const selectedDescendants = descendants.filter((d) =>
        selectedPages.some((p) => p.pageId === d.id),
      );

      let indeterminate = false;

      if (!isSelected && selectedDescendants.length > 0) {
        // Some descendants selected, some not
        indeterminate = selectedDescendants.length < descendants.length;
      }

      state.set(node.id, { selected: isSelected, indeterminate });

      node.children.forEach(processNode);
    };

    treeData.forEach(processNode);
    return state;
  }, [treeData, selectedPages]);
}