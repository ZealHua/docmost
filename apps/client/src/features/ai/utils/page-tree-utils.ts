import { NodeApi } from 'react-arborist';
import { AiPageSearchResult } from '../hooks/use-ai-page-search';

/**
 * Page tree node structure (matches backend DTO)
 */
export interface PageTreeItem {
  id: string;
  title: string | null;
  icon: string | null;
  slugId: string;
  spaceId: string;
  parentPageId: string | null;
  children: PageTreeItem[];
}

/**
 * Get all descendant nodes recursively.
 * Used for auto-selecting children when parent is selected.
 */
export function getAllDescendants(node: PageTreeItem): PageTreeItem[] {
  let descendants: PageTreeItem[] = [];
  node.children.forEach((child) => {
    descendants.push(child);
    descendants = descendants.concat(getAllDescendants(child));
  });
  return descendants;
}

/**
 * Get all ancestor IDs traversing UP the tree via NodeApi.
 * Used for removing ancestors when a child is manually deselected.
 */
export function getAncestorIds(node: NodeApi<PageTreeItem>): string[] {
  const ancestorIds: string[] = [];
  let current = node.parent;

  // react-arborist's internal root node usually has an id of null, so we stop there
  while (current && current.id !== null) {
    ancestorIds.push(current.id);
    current = current.parent;
  }

  return ancestorIds;
}

/**
 * Check if any descendant of a node is selected.
 * Used for indeterminate checkbox state.
 */
export function hasSelectedDescendant(
  node: PageTreeItem,
  selectedPages: AiPageSearchResult[],
): boolean {
  const descendants = getAllDescendants(node);
  return descendants.some((d) =>
    selectedPages.some((p) => p.pageId === d.id),
  );
}

/**
 * Check if all descendants of a node are selected.
 * Used for determining if a parent should be fully checked vs indeterminate.
 */
export function allDescendantsSelected(
  node: PageTreeItem,
  selectedPages: AiPageSearchResult[],
): boolean {
  const descendants = getAllDescendants(node);
  if (descendants.length === 0) return true; // No descendants, treat as all selected

  return descendants.every((d) =>
    selectedPages.some((p) => p.pageId === d.id),
  );
}