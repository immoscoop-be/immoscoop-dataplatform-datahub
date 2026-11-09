import { flushSync } from 'svelte';
import type { Collection, Folder } from './catalogue.js';
import { type Movable, within } from './folders.js';

/** Moves something of a Collection into one of its folders, or to its top with null (FR-CO-40). */
export type Mover = (collection: Collection, item: Movable, to: Folder | null) => void;

/**
 * What is being dragged, and where it would go, shared by the panel and the page (DEC-UX-157): a row is
 * dragged from one and dropped on a folder in the other, or in the path above the page.
 */
export const dragging = $state<{ item: Movable | null; over: string | null }>({ item: null, over: null });

const placeKey = (collectionId: string, folderId: string | null) => `${collectionId}/${folderId ?? ''}`;

/** The events that let the Owner Unit and the Data Team drag something; nothing for anyone else. */
export function dragOf(item: Movable, manage: boolean) {
  if (!manage) return {};
  return {
    draggable: true,
    ondragstart: (event: DragEvent) => {
      dragging.item = item;
      // The picture of the drag is taken now, so what it shows is drawn first.
      flushSync();
      const transfer = event.dataTransfer;
      if (!transfer) return;
      transfer.effectAllowed = 'move';
      transfer.setData('text/plain', item.name);
      const ghost = document.getElementById('drag-ghost');
      if (ghost) transfer.setDragImage(ghost, 14, 14);
    },
    ondragend: () => {
      dragging.item = null;
      dragging.over = null;
    },
  };
}

/** Whether what is dragged may go into this folder of the Collection, or its top: not where it is, not into itself. */
export function accepts(collection: Collection, folderId: string | null): boolean {
  const item = dragging.item;
  if (!item || item.collectionId !== collection.id || !collection.canManage || item.from === folderId) return false;
  return item.kind !== 'folder' || !within(collection, folderId, item.id);
}

/** Whether what is dragged is over this folder, and would go into it. */
export const isOver = (collection: Collection, folderId: string | null): boolean => dragging.over === placeKey(collection.id, folderId);

/** The events of a folder, or of the top of a Collection, that something is dropped on. */
export function dropOf(collection: Collection, folder: Folder | null, onmove: Mover) {
  const folderId = folder?.id ?? null;
  const here = placeKey(collection.id, folderId);
  return {
    ondragover: (event: DragEvent) => {
      if (!accepts(collection, folderId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      dragging.over = here;
    },
    ondragleave: (event: DragEvent) => {
      const left = event.currentTarget as Node | null;
      if (dragging.over === here && !(event.relatedTarget instanceof Node && left?.contains(event.relatedTarget))) dragging.over = null;
    },
    ondrop: (event: DragEvent) => {
      const item = dragging.item;
      if (!item || !accepts(collection, folderId)) return;
      event.preventDefault();
      event.stopPropagation();
      dragging.item = null;
      dragging.over = null;
      onmove(collection, item, folder);
    },
  };
}
